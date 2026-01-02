import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminApiPayload {
  action: 'get_dashboard_data' | 'search_users' | 'get_user_details' | 'bulk_approve_trials' | 'expire_trials' | 'update_user_status'
  user_id?: string
  user_ids?: string[]
  search_params?: {
    searchTerm?: string
    trialStatus?: string
    planStatus?: string
    industry?: string
    limit?: number
    offset?: number
  }
  update_data?: any
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

    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      throw new Error('Invalid authentication token')
    }

    // Verify admin role
    const { data: adminProfile, error: roleError } = await supabase
      .from('user_business_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !adminProfile || adminProfile.role !== 'admin') {
      throw new Error('Insufficient permissions - admin role required')
    }

    // Parse request payload
    const payload: AdminApiPayload = await req.json()
    console.log('Admin API request:', payload)

    let result: any = null

    switch (payload.action) {
      case 'get_dashboard_data':
        const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_admin_dashboard_data')
        if (dashboardError) throw dashboardError
        result = dashboardData
        break

      case 'search_users':
        const searchParams = payload.search_params || {}
        const { data: searchResults, error: searchError } = await supabase.rpc('admin_search_users', {
          p_search_term: searchParams.searchTerm || '',
          p_trial_status: searchParams.trialStatus || null,
          p_plan_status: searchParams.planStatus || null,
          p_industry: searchParams.industry || null,
          p_limit: searchParams.limit || 50,
          p_offset: searchParams.offset || 0
        })
        if (searchError) throw searchError
        result = searchResults
        break

      case 'get_user_details':
        if (!payload.user_id) throw new Error('user_id required for get_user_details')
        const { data: userDetails, error: detailsError } = await supabase.rpc('get_user_details_for_admin', {
          p_user_id: payload.user_id
        })
        if (detailsError) throw detailsError
        result = userDetails
        break

      case 'bulk_approve_trials':
        if (!payload.user_ids || payload.user_ids.length === 0) {
          throw new Error('user_ids array required for bulk_approve_trials')
        }
        const { data: bulkResult, error: bulkError } = await supabase.rpc('bulk_approve_trials', {
          p_user_ids: payload.user_ids
        })
        if (bulkError) throw bulkError
        
        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_admin_user_id: user.id,
          p_target_user_id: null,
          p_action: 'bulk_approve_trials',
          p_details: { user_ids: payload.user_ids, result: bulkResult }
        })
        
        result = bulkResult
        break

      case 'expire_trials':
        const { data: expireResult, error: expireError } = await supabase.rpc('expire_trials')
        if (expireError) throw expireError
        
        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_admin_user_id: user.id,
          p_target_user_id: null,
          p_action: 'expire_trials',
          p_details: expireResult
        })
        
        result = expireResult
        break

      case 'update_user_status':
        if (!payload.user_id || !payload.update_data) {
          throw new Error('user_id and update_data required for update_user_status')
        }
        
        const { data: updateResult, error: updateError } = await supabase
          .from('user_business_profiles')
          .update(payload.update_data)
          .eq('user_id', payload.user_id)
          .select()
          .single()
        
        if (updateError) throw updateError
        
        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_admin_user_id: user.id,
          p_target_user_id: payload.user_id,
          p_action: 'update_user_status',
          p_details: { changes: payload.update_data }
        })
        
        result = updateResult
        break

      default:
        throw new Error(`Unknown action: ${payload.action}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in admin API:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('permissions') ? 403 : 500
      }
    )
  }
})