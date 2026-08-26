/**
 * Test Database Connection and Schema
 * Run: node scripts/test-connection.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zouxakzclowsinofbnps.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvdXhha3pjbG93c2lub2ZibnBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0NTE5MywiZXhwIjoyMDk0NTIxMTkzfQ.wM7Lhmq9SpUUqFz-fWiqFM1XKHHoBNViksxd2qycKEk';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('🔍 Testing database connection and schema...\n');
  
  // Test 1: Check if audit_logs table is accessible
  console.log('1. Testing audit_logs table...');
  const { data: logs, error: logsError } = await supabase
    .from('audit_logs')
    .select('*')
    .limit(1);
  
  if (logsError) {
    console.log('   ❌ ERROR:', logsError.message);
  } else {
    console.log('   ✅ audit_logs table is accessible');
    console.log('   📊 Found', logs?.length || 0, 'record(s)');
  }
  
  // Test 2: Check if loan_products table is accessible
  console.log('\n2. Testing loan_products table...');
  const { data: products, error: productsError } = await supabase
    .from('loan_products')
    .select('*')
    .limit(1);
  
  if (productsError) {
    console.log('   ❌ ERROR:', productsError.message);
  } else {
    console.log('   ✅ loan_products table is accessible');
    console.log('   📊 Found', products?.length || 0, 'record(s)');
  }
  
  // Test 3: Try to write to audit_logs
  console.log('\n3. Testing audit_logs write...');
  const { data: insertData, error: insertError } = await supabase
    .from('audit_logs')
    .insert({
      actor_role: 'admin',
      action: 'CONFIGURATION_CHANGED',
      reason: 'Test connection from migration script',
      metadata: { test: true }
    })
    .select();
  
  if (insertError) {
    console.log('   ❌ ERROR:', insertError.message);
  } else {
    console.log('   ✅ Successfully wrote to audit_logs');
    console.log('   📝 Log ID:', insertData?.[0]?.id);
  }
  
  // Test 4: Check user profile for admin
  console.log('\n4. Checking admin user profile...');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', 'af2ae46e-2df4-4048-b68f-586efe0d7c38')
    .single();
  
  if (profileError) {
    console.log('   ❌ ERROR:', profileError.message);
  } else {
    console.log('   ✅ User profile found');
    console.log('   👤 Role:', profile.role);
    console.log('   🔗 Member ID:', profile.member_id || 'Not linked');
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log('✅ Connection test complete!\n');
}

main().catch(err => {
  console.error('\n💥 Error:', err.message);
  process.exit(1);
});
