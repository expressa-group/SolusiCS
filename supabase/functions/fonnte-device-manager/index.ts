import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeviceManagerPayload {
  action: 'start-connection' | 'check-status' | 'disconnect' | 'get-device-status'
  user_id: string
  whatsapp_number?: string
  device_id?: string
}

interface FonnteDeviceResponse {
  status: boolean
  data?: {
    device: string
    qr?: string
    status?: string
    message?: string
    token?: string
  }
  message?: string
  reason?: string
  url?: string
}

interface FonnteDevice {
  device: string
  status: string
  token: string
  name: string
  package: string
  quota: string
  expired: string
  'ai-data': string
  'ai-quota': string
  autoread: string
}

interface FonnteGetDevicesResponse {
  status: boolean
  data?: FonnteDevice[]
  devices?: number
  connected?: number
  reason?: string
}
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get FonNte token
    const fonnteToken = Deno.env.get('FONNTE_TOKEN')
    if (!fonnteToken) {
      console.error('FONNTE_TOKEN environment variable is not set')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'FONNTE_TOKEN not configured. Please set the token using: supabase secrets set FONNTE_TOKEN=your_token'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Validate token format (basic check)
    if (fonnteToken.length < 10) {
      console.error('FONNTE_TOKEN appears to be invalid (too short)')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'FONNTE_TOKEN appears to be invalid. Please check your token.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Parse request payload
    const payload: DeviceManagerPayload = await req.json()
    console.log('Device manager request:', payload)

    const { action, user_id: userId, whatsapp_number: whatsappNumber, device_id: deviceId } = payload

    // Verify user exists
    const { data: userProfile, error: userError } = await supabase
      .from('user_business_profiles')
      .select('id, whatsapp_number, fonnte_device_id, fonnte_status')
      .eq('user_id', userId)
      .single()

    if (userError || !userProfile) {
      throw new Error('User profile not found')
    }

    switch (action) {
      case 'start-connection':
        return await handleStartConnection(supabase, fonnteToken, userId, whatsappNumber!)
      
      case 'get-device-status':
        return await handleGetDeviceStatus(supabase, fonnteToken, userId, whatsappNumber!)
      
      case 'check-status':
        return await handleCheckStatus(supabase, fonnteToken, userId, userProfile.fonnte_device_id)
      
      case 'disconnect':
        return await handleDisconnect(supabase, fonnteToken, userId, userProfile.fonnte_device_id)
      
      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('Error in fonnte-device-manager:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function handleGetDeviceStatus(
  supabase: any,
  fonnteToken: string,
  userId: string,
  whatsappNumber: string
): Promise<Response> {
  try {
    console.log('Getting device status for:', whatsappNumber)
    console.log('Using FonNte account token (first 10 chars):', fonnteToken.substring(0, 10) + '...')

    // Clean the WhatsApp number (remove non-digits)
    const cleanNumber = whatsappNumber.replace(/\D/g, '')

    console.log('=== GET DEVICE STATUS DEBUG ===')
    console.log('Original WhatsApp number:', whatsappNumber)
    console.log('Cleaned WhatsApp number:', cleanNumber)
    // Call FonNte API to get all devices
    const response = await fetch('https://api.fonnte.com/get-devices', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken,
        'Content-Type': 'application/json',
      }
    })

    console.log('FonNte get-devices response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('FonNte API error response:', errorText)
      throw new Error(`FonNte API error: ${response.status} - ${errorText}`)
    }

    const fonnteData: FonnteGetDevicesResponse = await response.json()
    console.log('FonNte get-devices response:', fonnteData)

    if (!fonnteData.status) {
      // Handle token invalid error specifically
      if (fonnteData.reason === 'token invalid') {
        console.error('FonNte account token is invalid')
        throw new Error('FonNte account token is invalid. Please check your FONNTE_TOKEN configuration.')
      }
      throw new Error(fonnteData.reason || 'Failed to get devices')
    }

    // Find our device in the response
    const devices = fonnteData.data || []
    const ourDevice = devices.find((device: FonnteDevice) => device.device === cleanNumber)

    console.log('=== DEVICE SEARCH RESULTS ===')
    console.log('Total devices in account:', devices.length)
    console.log('All device numbers:', devices.map(d => d.device))
    console.log('Looking for device number:', cleanNumber)
    console.log('Device found:', !!ourDevice)
    if (ourDevice) {
      console.log('Found device details:', {
        device: ourDevice.device,
        status: ourDevice.status,
        name: ourDevice.name,
        token_available: !!ourDevice.token,
        token_length: ourDevice.token ? ourDevice.token.length : 0
      })
    }
    let deviceState = 'not_found'
    let deviceInfo = null

    if (ourDevice) {
      deviceInfo = ourDevice
      console.log('=== DEVICE STATE MAPPING ===')
      console.log('FonNte status:', ourDevice.status)
      switch (ourDevice.status) {
        case 'connect':
          deviceState = 'registered_connected'
          console.log('Mapped to: registered_connected')
          break
        case 'disconnect':
          deviceState = 'registered_disconnected'
          console.log('Mapped to: registered_disconnected')
          break
        case 'scan':
          deviceState = 'registered_scanning_qr'
          console.log('Mapped to: registered_scanning_qr')
          break
        default:
          deviceState = 'registered_error'
          console.log('Mapped to: registered_error (unknown status:', ourDevice.status, ')')
      }
    } else {
      console.log('Device not found in FonNte account - mapped to: not_found')
    }

    console.log('=== FINAL RESULT ===')
    console.log('Device state:', deviceState)
    console.log('Device info available:', !!deviceInfo)
    console.log('Clean number:', cleanNumber)
    console.log('Total devices:', fonnteData.devices || 0)
    console.log('Connected devices:', fonnteData.connected || 0)
    return new Response(
      JSON.stringify({
        success: true,
        device_state: deviceState,
        device_info: deviceInfo,
        clean_number: cleanNumber,
        total_devices: fonnteData.devices || 0,
        connected_devices: fonnteData.connected || 0,
        debug_info: {
          original_number: whatsappNumber,
          cleaned_number: cleanNumber,
          device_found: !!ourDevice,
          fonnte_status: ourDevice?.status || 'not_found',
          mapped_state: deviceState,
          all_devices: devices.map(d => ({ device: d.device, status: d.status }))
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in handleGetDeviceStatus:', error)
    console.error('=== GET DEVICE STATUS ERROR DEBUG ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('User ID:', userId)
    console.error('WhatsApp number:', whatsappNumber)
    throw error
  }
}

async function handleStartConnection(
  supabase: any,
  fonnteToken: string,
  userId: string,
  whatsappNumber: string
): Promise<Response> {
  try {
    console.log('Starting WhatsApp connection for:', whatsappNumber)
    console.log('Using FonNte token (first 10 chars):', fonnteToken.substring(0, 10) + '...')

    // Clean the WhatsApp number (remove non-digits)
    const cleanNumber = whatsappNumber.replace(/\D/g, '')
    console.log('Cleaned WhatsApp number:', cleanNumber)

    // Step 1: Get all devices using account token to find the device-specific token
    console.log('Step 1: Getting all devices to find device token...')
    const getDevicesResponse = await fetch('https://api.fonnte.com/get-devices', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken,
        'Content-Type': 'application/json',
      }
    })

    console.log('FonNte get-devices response status:', getDevicesResponse.status)

    if (!getDevicesResponse.ok) {
      const errorText = await getDevicesResponse.text()
      console.error('FonNte get-devices API error response:', errorText)
      throw new Error(`FonNte get-devices API error: ${getDevicesResponse.status} - ${errorText}`)
    }

    const devicesData: FonnteGetDevicesResponse = await getDevicesResponse.json()
    console.log('FonNte get-devices response:', devicesData)

    if (!devicesData.status) {
      // Handle token invalid error specifically
      if (devicesData.reason === 'token invalid') {
        console.error('FonNte account token is invalid')
        throw new Error('FonNte account token is invalid. Please check your FONNTE_TOKEN configuration.')
      }
      throw new Error(devicesData.reason || 'Failed to get devices')
    }

    // Step 2: Find the specific device that matches our WhatsApp number
    const devices = devicesData.data || []
    const targetDevice = devices.find((device: FonnteDevice) => device.device === cleanNumber)

    console.log('=== START CONNECTION DEBUG ===')
    console.log('Looking for device:', cleanNumber)
    console.log('Available devices:', devices.map(d => ({ device: d.device, status: d.status, name: d.name })))
    console.log('Target device found:', !!targetDevice)
    if (!targetDevice) {
      console.error(`Device ${cleanNumber} not found in FonNte account`)
      console.error('Available device numbers:', devices.map(d => d.device))
      throw new Error(`WhatsApp number ${cleanNumber} is not registered in your FonNte account. Please register it first in FonNte dashboard.`)
    }

    console.log('Found target device:', targetDevice)
    
    console.log('=== TOKEN EXTRACTION DEBUG ===')
    // Validate device token from FonNte API
    const tokenFromFonnte = targetDevice.token
    console.log('Raw device token from FonNte:', tokenFromFonnte)
    console.log('Device token type:', typeof tokenFromFonnte)
    console.log('Device token length:', tokenFromFonnte ? tokenFromFonnte.length : 0)
    console.log('Device token is valid string:', typeof tokenFromFonnte === 'string' && tokenFromFonnte.trim() !== '')
    
    const fonnteDeviceTokenToStore = (typeof tokenFromFonnte === 'string' && tokenFromFonnte.trim() !== '')
      ? tokenFromFonnte.trim()
      : null
    
    if (!fonnteDeviceTokenToStore) {
      console.error('Invalid or empty device token received from FonNte API')
      console.error('Target device data:', targetDevice)
      console.error('This is a critical error - device token is required for sending messages')
      throw new Error('Invalid device token received from FonNte. Device may not be properly registered.')
    }
    
    console.log('Validated device token (first 10 chars):', fonnteDeviceTokenToStore.substring(0, 10) + '...')

    // Step 3: Check if device is already connected
    console.log('=== DEVICE STATUS CHECK ===')
    console.log('FonNte device status:', targetDevice.status)
    if (targetDevice.status === 'connect') {
      console.log('Device is already connected')
      console.log('Will update database with connected status and store token')
      
      const updateDataForConnected = {
        fonnte_device_id: cleanNumber,
        fonnte_device_token: fonnteDeviceTokenToStore,
        fonnte_status: 'connected',
        fonnte_qr_code_url: null,
        fonnte_connected_at: new Date().toISOString()
      }
      
      console.log('=== DATABASE UPDATE FOR CONNECTED DEVICE ===')
      console.log('Update data:', JSON.stringify(updateDataForConnected, null, 2))
      console.log('Updating user_id:', userId)

      // Update user profile to reflect connected status
      const { data: updateResult, error: updateError } = await supabase
        .from('user_business_profiles')
        .update(updateDataForConnected)
        .eq('user_id', userId)
        .select()

      if (updateError) {
        console.error('Error updating user profile:', updateError)
        console.error('Update data that failed:', JSON.stringify(updateDataForConnected, null, 2))
        console.error('User ID that failed:', userId)
        throw updateError
      }
      
      console.log('=== DATABASE UPDATE SUCCESS FOR CONNECTED ===')
      console.log('User profile updated successfully for connected device')
      console.log('Updated record:', JSON.stringify(updateResult, null, 2))
      console.log('Confirming stored values:')
      console.log('- fonnte_status:', updateResult?.[0]?.fonnte_status)
      console.log('- fonnte_device_token available:', !!updateResult?.[0]?.fonnte_device_token)
      console.log('- fonnte_device_id:', updateResult?.[0]?.fonnte_device_id)
      console.log('- fonnte_connected_at:', updateResult?.[0]?.fonnte_connected_at)

      return new Response(
        JSON.stringify({
          success: true,
          device_id: cleanNumber,
          qr_code: null,
          status: 'connected',
          message: 'Device is already connected',
          device_token_stored: !!fonnteDeviceTokenToStore,
          debug_info: {
            fonnte_device_status: targetDevice.status,
            mapped_status: 'connected',
            token_stored: !!fonnteDeviceTokenToStore,
            database_result: updateResult?.[0] || null
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 4: Get QR code using device-specific token
    console.log('Step 4: Getting QR code using device token...')
    console.log('Device needs QR code, current status:', targetDevice.status)
    const response = await fetch('https://api.fonnte.com/qr', {
      method: 'POST',
      headers: {
        'Authorization': fonnteDeviceTokenToStore,
        'Content-Type': 'application/json',
      },
    })

    console.log('FonNte API response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('FonNte API error response:', errorText)
      throw new Error(`FonNte API error: ${response.status} - ${errorText}`)
    }

    const fonnteData: FonnteDeviceResponse = await response.json()
    console.log('FonNte QR response:', fonnteData)


    if (!fonnteData.status) {
      // Handle token invalid error specifically
      if (fonnteData.reason === 'token invalid') {
        console.error('FonNte device token is invalid')
        throw new Error('FonNte device token is invalid. This should not happen if device exists.')
      }
      throw new Error(fonnteData.reason || fonnteData.message || 'Failed to get QR code')
    }

    const qrCode = fonnteData.url // QR code is in 'url' field for /qr endpoint

    console.log('QR code obtained successfully')

    const updateDataForQR = {
      fonnte_device_id: cleanNumber,
      fonnte_device_token: fonnteDeviceTokenToStore,
      fonnte_status: qrCode ? 'scanning_qr' : 'connected',
      fonnte_qr_code_url: qrCode || null,
      fonnte_connected_at: qrCode ? null : new Date().toISOString()
    }
    
    console.log('=== DATABASE UPDATE FOR QR SCANNING ===')
    console.log('Update data:', JSON.stringify(updateDataForQR, null, 2))
    console.log('Updating user_id:', userId)
    // Update user profile with device info
    const { data: updateResult, error: updateError } = await supabase
      .from('user_business_profiles')
      .update(updateDataForQR)
      .eq('user_id', userId)
      .select()

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      console.error('Update data that failed:', JSON.stringify(updateDataForQR, null, 2))
      console.error('User ID that failed:', userId)
      throw updateError
    }
    
    console.log('=== DATABASE UPDATE SUCCESS FOR QR ===')
    console.log('User profile updated successfully for QR scanning')
    console.log('Updated record:', JSON.stringify(updateResult, null, 2))
    console.log('Confirming stored values:')
    console.log('- fonnte_status:', updateResult?.[0]?.fonnte_status)
    console.log('- fonnte_device_token available:', !!updateResult?.[0]?.fonnte_device_token)
    console.log('- fonnte_device_id:', updateResult?.[0]?.fonnte_device_id)
    console.log('- fonnte_qr_code_url available:', !!updateResult?.[0]?.fonnte_qr_code_url)

    return new Response(
      JSON.stringify({
        success: true,
        device_id: cleanNumber,
        qr_code: qrCode,
        status: qrCode ? 'scanning_qr' : 'connected',
        message: qrCode ? 'Scan QR code with WhatsApp' : 'Device connected successfully',
        device_token_stored: !!fonnteDeviceTokenToStore,
        debug_info: {
          fonnte_device_status: targetDevice.status,
          mapped_status: qrCode ? 'scanning_qr' : 'connected',
          token_stored: !!fonnteDeviceTokenToStore,
          qr_available: !!qrCode,
          database_result: updateResult?.[0] || null
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in handleStartConnection:', error)
    console.error('=== START CONNECTION ERROR DEBUG ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('User ID:', userId)
    console.error('WhatsApp number:', whatsappNumber)
    
    // Update status to error
    try {
      const errorUpdateData = {
        fonnte_status: 'error',
        fonnte_qr_code_url: null,
        // Note: Preserve fonnte_device_id and fonnte_device_token to maintain connection
        // even if there's a temporary error during QR code generation
      }
      
      console.log('Updating status to error with data:', JSON.stringify(errorUpdateData, null, 2))
      
      await supabase
      .from('user_business_profiles')
        .update(errorUpdateData)
      .eq('user_id', userId)
      
      console.log('Error status updated in database')
    } catch (updateError) {
      console.error('Failed to update error status in database:', updateError)
    }

    throw error
  }
}

async function handleCheckStatus(
  supabase: any,
  fonnteToken: string,
  userId: string,
  deviceId: string | null
): Promise<Response> {
  try {
    if (!deviceId) {
      throw new Error('No device ID found')
    }

    console.log('Checking device status for:', deviceId)
    console.log('Using FonNte account token (first 10 chars):', fonnteToken.substring(0, 10) + '...')

    // Call FonNte API to check device status
    const response = await fetch('https://api.fonnte.com/get-devices', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken,
        'Content-Type': 'application/json',
      }
    })

    console.log('FonNte get-devices response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('FonNte API error response:', errorText)
      throw new Error(`FonNte API error: ${response.status} - ${errorText}`)
    }

    const fonnteData: FonnteGetDevicesResponse = await response.json()
    console.log('FonNte get-devices response:', fonnteData)

    if (!fonnteData.status) {
      // Handle token invalid error specifically
      if (fonnteData.reason === 'token invalid') {
        console.error('FonNte account token is invalid')
        throw new Error('FonNte account token is invalid. Please check your FONNTE_TOKEN configuration.')
      }
      throw new Error(fonnteData.reason || 'Failed to get devices')
    }

    // Find our device in the response
    const devices = fonnteData.data || []
    const ourDevice = devices.find((device: FonnteDevice) => device.device === deviceId)

    // ENHANCED LOGGING: Log device search results
    console.log('=== DEVICE STATUS CHECK DEBUG ===')
    console.log('Looking for device ID:', deviceId)
    console.log('Total devices found:', devices.length)
    console.log('All devices:', devices.map(d => ({ device: d.device, status: d.status, name: d.name })))
    console.log('Our device found:', !!ourDevice)
    if (ourDevice) {
      console.log('Our device details:', {
        device: ourDevice.device,
        status: ourDevice.status,
        name: ourDevice.name,
        token_available: !!ourDevice.token,
        token_length: ourDevice.token ? ourDevice.token.length : 0,
        token_first_10: ourDevice.token ? ourDevice.token.substring(0, 10) + '...' : 'null'
      })
    }
    let status = 'disconnected'
    let connectedAt = null
    let fonnteDeviceTokenToStore = null

    if (ourDevice) {
      console.log('=== TOKEN VALIDATION DEBUG ===')
      // Validate device token from FonNte API
      const tokenFromFonnte = ourDevice.token
      console.log('Raw device token from FonNte check status:', tokenFromFonnte)
      console.log('Device token type:', typeof tokenFromFonnte)
      console.log('Device token length:', tokenFromFonnte ? tokenFromFonnte.length : 0)
      console.log('Device token is string:', typeof tokenFromFonnte === 'string')
      console.log('Device token is not empty:', tokenFromFonnte && tokenFromFonnte.trim() !== '')
      
      fonnteDeviceTokenToStore = (typeof tokenFromFonnte === 'string' && tokenFromFonnte.trim() !== '')
        ? tokenFromFonnte.trim()
        : null
      
      console.log('Token validation result:')
      console.log('- Will store token:', !!fonnteDeviceTokenToStore)
      if (fonnteDeviceTokenToStore) {
        console.log('Valid device token found (first 10 chars):', fonnteDeviceTokenToStore.substring(0, 10) + '...')
      } else {
        console.warn('Invalid or empty device token from FonNte API during status check')
        console.warn('This will cause WhatsApp message sending to fail!')
      }
      
      console.log('=== STATUS MAPPING DEBUG ===')
      console.log('FonNte device status:', ourDevice.status)
      switch (ourDevice.status) {
        case 'connect':
          status = 'connected'
          connectedAt = new Date().toISOString()
          console.log('Mapped to: connected, setting connectedAt:', connectedAt)
          break
        case 'disconnect':
          status = 'disconnected'
          fonnteDeviceTokenToStore = null
          console.log('Mapped to: disconnected, clearing token')
          break
        case 'scan':
          status = 'scanning_qr'
          console.log('Mapped to: scanning_qr')
          break
        default:
          status = 'error'
          fonnteDeviceTokenToStore = null
          console.log('Mapped to: error, clearing token')
      }
    } else {
      console.log('=== DEVICE NOT FOUND DEBUG ===')
      console.log('Device not found in FonNte response')
      console.log('This means device is not registered or has been removed')
      status = 'disconnected'
      fonnteDeviceTokenToStore = null
    }

    console.log('=== DATABASE UPDATE DEBUG ===')
    console.log('Final status to store:', status)
    console.log('Final token to store:', fonnteDeviceTokenToStore ? 'YES (length: ' + fonnteDeviceTokenToStore.length + ')' : 'NULL')
    console.log('Connected at to store:', connectedAt)
    // Update user profile with current status
    const updateData: any = {
      fonnte_status: status,
      fonnte_device_token: fonnteDeviceTokenToStore
    }

    if (status === 'connected' && connectedAt) {
      updateData.fonnte_connected_at = connectedAt
      updateData.fonnte_qr_code_url = null // Clear QR code when connected
      console.log('Adding connected timestamp and clearing QR code')
    } else if (status === 'disconnected') {
      updateData.fonnte_connected_at = null
      updateData.fonnte_qr_code_url = null
      updateData.fonnte_device_id = null
      console.log('Clearing all connection data for disconnected status')
    } else if (status === 'error') {
      updateData.fonnte_qr_code_url = null
      console.log('Clearing QR code for error status')
    }

    console.log('Complete update data object:', JSON.stringify(updateData, null, 2))
    console.log('Updating user_business_profiles for user_id:', userId)
    const { data: updateResult, error: updateError } = await supabase
      .from('user_business_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select()

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      console.error('Update data that failed:', JSON.stringify(updateData, null, 2))
      console.error('User ID that failed:', userId)
      throw updateError
    }
    
    console.log('=== DATABASE UPDATE SUCCESS ===')
    console.log('User profile updated successfully during status check')
    console.log('Updated record:', JSON.stringify(updateResult, null, 2))
    console.log('Confirming stored values:')
    console.log('- fonnte_status:', updateResult?.[0]?.fonnte_status)
    console.log('- fonnte_device_token available:', !!updateResult?.[0]?.fonnte_device_token)
    console.log('- fonnte_device_id:', updateResult?.[0]?.fonnte_device_id)
    console.log('- fonnte_connected_at:', updateResult?.[0]?.fonnte_connected_at)
    
    if (fonnteDeviceTokenToStore) {
      console.log('Device token stored successfully (first 10 chars):', fonnteDeviceTokenToStore.substring(0, 10) + '...')
    } else {
      console.log('Device token cleared or not available')
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: status,
        device_id: deviceId,
        connected_at: connectedAt,
        device_info: ourDevice,
        device_token_stored: !!fonnteDeviceTokenToStore,
        debug_info: {
          fonnte_device_status: ourDevice?.status,
          mapped_status: status,
          token_length: fonnteDeviceTokenToStore ? fonnteDeviceTokenToStore.length : 0,
          update_data: updateData,
          database_result: updateResult?.[0] || null
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in handleCheckStatus:', error)
    console.error('=== CHECK STATUS ERROR DEBUG ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('User ID:', userId)
    console.error('Device ID:', deviceId)
    throw error
  }
}

async function handleDisconnect(
  supabase: any,
  fonnteToken: string,
  userId: string,
  deviceId: string | null
): Promise<Response> {
  try {
    if (!deviceId) {
      throw new Error('No device ID found')
    }

    console.log('Disconnecting device:', deviceId)
    console.log('Using FonNte account token (first 10 chars):', fonnteToken.substring(0, 10) + '...')

    console.log('=== DISCONNECT DEVICE DEBUG ===')
    console.log('Device ID to disconnect:', deviceId)
    console.log('User ID:', userId)
    // Call FonNte API to remove device
    const response = await fetch('https://api.fonnte.com/remove-device', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device: deviceId
      })
    })

    console.log('FonNte remove-device response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`FonNte API warning: ${response.status} - ${errorText}`)
      console.warn('Continuing with database cleanup despite FonNte API error')
      // Continue anyway, as we want to clean up our database
    }

    const disconnectUpdateData = {
      fonnte_device_id: null,
      fonnte_device_token: null,
      fonnte_status: 'disconnected',
      fonnte_qr_code_url: null,
      fonnte_connected_at: null
    }
    
    console.log('=== DATABASE UPDATE FOR DISCONNECT ===')
    console.log('Update data:', JSON.stringify(disconnectUpdateData, null, 2))
    console.log('Updating user_id:', userId)
    // Update user profile to disconnected state
    const { error: updateError } = await supabase
      .from('user_business_profiles')
      .update(disconnectUpdateData)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      console.error('Update data that failed:', JSON.stringify(disconnectUpdateData, null, 2))
      console.error('User ID that failed:', userId)
      throw updateError
    }

    console.log('=== DISCONNECT SUCCESS ===')
    console.log('User profile updated successfully - all FonNte data cleared')
    return new Response(
      JSON.stringify({
        success: true,
        status: 'disconnected',
        message: 'Device disconnected successfully',
        debug_info: {
          device_id_cleared: deviceId,
          database_updated: true,
          fonnte_api_called: true
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in handleDisconnect:', error)
    console.error('=== DISCONNECT ERROR DEBUG ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('User ID:', userId)
    console.error('Device ID:', deviceId)
    throw error
  }
}