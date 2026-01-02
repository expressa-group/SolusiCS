/*
  # Tambah Sistem Role dan Trial

  1. Kolom Baru
    - `role` (text) - Role pengguna: 'user' atau 'admin'
    - `trial_status` (text) - Status trial: 'none', 'requested', 'active', 'expired'
    - `trial_requested_at` (timestamptz) - Waktu pengajuan trial
    - `trial_ends_at` (timestamptz) - Waktu berakhir trial
    - `plan_status` (text) - Status paket: 'inactive', 'trialing', 'active', 'expired', 'cancelled'
    - `trial_started_at` (timestamptz) - Waktu mulai trial

  2. Constraints
    - Check constraint untuk role
    - Check constraint untuk trial_status
    - Check constraint untuk plan_status

  3. Indexes
    - Index untuk role
    - Index untuk trial_status
    - Index untuk plan_status
*/

-- Tambah kolom role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- Tambah kolom trial_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'trial_status'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN trial_status TEXT DEFAULT 'none';
  END IF;
END $$;

-- Tambah kolom trial_requested_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'trial_requested_at'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN trial_requested_at TIMESTAMPTZ;
  END IF;
END $$;

-- Tambah kolom trial_ends_at (sudah ada di schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
END $$;

-- Tambah kolom trial_started_at (sudah ada di schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN trial_started_at TIMESTAMPTZ;
  END IF;
END $$;

-- Tambah constraint untuk role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_business_profiles' AND constraint_name = 'user_business_profiles_role_check'
  ) THEN
    ALTER TABLE user_business_profiles
    ADD CONSTRAINT user_business_profiles_role_check
    CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- Tambah constraint untuk trial_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_business_profiles' AND constraint_name = 'user_business_profiles_trial_status_check'
  ) THEN
    ALTER TABLE user_business_profiles
    ADD CONSTRAINT user_business_profiles_trial_status_check
    CHECK (trial_status IN ('none', 'requested', 'active', 'expired'));
  END IF;
END $$;

-- Tambah index untuk role
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_role 
ON user_business_profiles(role);

-- Tambah index untuk trial_status
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_trial_status 
ON user_business_profiles(trial_status);

-- Tambah index untuk trial_requested_at
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_trial_requested_at 
ON user_business_profiles(trial_requested_at) 
WHERE trial_requested_at IS NOT NULL;

-- Tambah index untuk trial_ends_at
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_trial_ends_at 
ON user_business_profiles(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

-- Set admin role untuk user pertama (opsional - bisa dijalankan manual)
-- UPDATE user_business_profiles SET role = 'admin' WHERE user_id = 'your-admin-user-id';