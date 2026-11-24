-- TriloWMS step 2 of 2: create the 12 login accounts in Supabase Auth.
-- Run AFTER 004_auth_lockdown.sql. Safe to run again: existing accounts are skipped.
-- Passwords below are random and shown only in the file trilowms-logins.csv. Change them
-- anytime in Supabase -> Authentication -> Users.

with wanted(email, pw, full_name, app_role) as (values
  ('admin@trilowms.com', 'xpvYAOHwGrxa!61', 'Alex Rodriguez', 'super_admin'),
  ('whadmin@trilowms.com', 'wyn5vE2oJUgR#75', 'Maria Chen', 'warehouse_admin'),
  ('ops@trilowms.com', 'emEc4Mcels6M#55', 'James Okafor', 'operations_manager'),
  ('inventory@trilowms.com', 'KIQk35KUL73e#36', 'Priya Nair', 'inventory_manager'),
  ('inbound@trilowms.com', 'om7QanVqu2Ge#59', 'Diego Vasquez', 'inbound_supervisor'),
  ('outbound@trilowms.com', 'FrvMOwHq7Pzf$37', 'Sarah Kim', 'outbound_supervisor'),
  ('picker1@trilowms.com', 'c40bBDKaPt7u%15', 'Marcus Johnson', 'picker'),
  ('forklift@trilowms.com', '5SBPSCe83AFn$47', 'Tommy Wu', 'forklift_operator'),
  ('qc@trilowms.com', 'na3eBtNib0BL%48', 'Aisha Patel', 'qc_inspector'),
  ('packing@trilowms.com', 'GIcEb9vAKB4B#20', 'Carlos Mendez', 'packing_operator'),
  ('yard@trilowms.com', 'neVvQREelMQx%99', 'Fatima Al-Hassan', 'yard_manager'),
  ('audit@trilowms.com', 'qJPN6pUYLURG$87', 'Robert Steele', 'auditor')
), ins as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         w.email, crypt(w.pw, gen_salt('bf')), now(),
         jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'wms_role',w.app_role),
         jsonb_build_object('full_name', w.full_name), now(), now(), '', '', '', ''
  from wanted w
  where not exists (select 1 from auth.users u where lower(u.email) = lower(w.email))
  returning id, email
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), i.id, jsonb_build_object('sub', i.id::text, 'email', i.email, 'email_verified', true),
       'email', i.id::text, now(), now(), now()
from ins i;

select email, created_at from auth.users where email like '%@trilowms.com' order by email;
