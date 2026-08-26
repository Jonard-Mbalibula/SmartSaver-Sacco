/**
 * Reset Admin Password
 * Run: node scripts/reset-admin-password.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zouxakzclowsinofbnps.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvdXhha3pjbG93c2lub2ZibnBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0NTE5MywiZXhwIjoyMDk0NTIxMTkzfQ.wM7Lhmq9SpUUqFz-fWiqFM1XKHHoBNViksxd2qycKEk';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ADMIN_USER_ID = 'af2ae46e-2df4-4048-b68f-586efe0d7c38';
const ADMIN_EMAIL = 'smartsaversacco@gmail.com';
const NEW_PASSWORD = 'Admin@2026'; // Change this to your preferred password

async function main() {
  console.log('🔐 Resetting admin password...\n');
  
  // Update password for admin user
  const { data, error } = await supabase.auth.admin.updateUserById(
    ADMIN_USER_ID,
    { password: NEW_PASSWORD }
  );
  
  if (error) {
    console.error('❌ Failed to reset password:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Password reset successful!\n');
  console.log('─'.repeat(60));
  console.log('📋 ADMIN LOGIN CREDENTIALS:');
  console.log('─'.repeat(60));
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${NEW_PASSWORD}`);
  console.log('─'.repeat(60));
  console.log('\n💡 Next steps:');
  console.log('1. Go to: http://localhost:3000/login');
  console.log(`2. Login with the credentials above`);
  console.log('3. You will be redirected to /dashboard');
  console.log('\n⚠️  IMPORTANT: Change this password after logging in!\n');
}

main().catch(err => {
  console.error('\n💥 Error:', err.message);
  process.exit(1);
});
