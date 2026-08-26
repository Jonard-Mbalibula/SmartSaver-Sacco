/**
 * Admin Access Fix Script
 * Run: node scripts/fix-admin-access.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables!');
  console.error('Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('🔍 Checking users and admin access...\n');

  // 1. Get all users from auth.users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('❌ Error fetching users:', usersError.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('❌ No users found in the database!');
    console.log('Please register a user first at: http://localhost:3000/register');
    process.exit(1);
  }

  console.log(`✅ Found ${users.length} user(s) in auth.users\n`);

  // 2. Get all user profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*');

  if (profilesError) {
    console.error('❌ Error fetching user profiles:', profilesError.message);
    process.exit(1);
  }

  console.log(`✅ Found ${profiles?.length || 0} profile(s) in user_profiles\n`);

  // 3. Show all users with their profile status
  console.log('📋 USER LIST:');
  console.log('─'.repeat(80));

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  users.forEach((user, index) => {
    const profile = profileMap.get(user.id);
    const email = user.email || 'No email';
    const role = profile?.role || '❌ NO PROFILE';
    const isAdmin = profile?.role === 'admin';
    
    console.log(`\n${index + 1}. Email: ${email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Role: ${isAdmin ? '👑 ADMIN' : role}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    
    if (!profile) {
      console.log(`   ⚠️  WARNING: No user_profile entry! This user cannot login properly.`);
    }
  });

  console.log('\n' + '─'.repeat(80));

  // 4. Check if there's at least one admin
  const adminCount = profiles?.filter(p => p.role === 'admin').length || 0;
  
  if (adminCount === 0) {
    console.log('\n❌ NO ADMIN USERS FOUND!');
    console.log('\n📝 To fix this, run ONE of these SQL queries in Supabase SQL Editor:');
    console.log('─'.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`\n-- Option ${index + 1}: Promote ${user.email} to admin`);
      console.log(`UPDATE public.user_profiles SET role = 'admin' WHERE id = '${user.id}';`);
      
      // If no profile exists, show INSERT statement
      if (!profileMap.has(user.id)) {
        console.log(`-- OR if profile doesn't exist, create it:`);
        console.log(`INSERT INTO public.user_profiles (id, role) VALUES ('${user.id}', 'admin');`);
      }
    });
    
    console.log('\n' + '─'.repeat(80));
    console.log('\n💡 After running the SQL query, the user can login at:');
    console.log('   http://localhost:3000/login');
  } else {
    console.log(`\n✅ Found ${adminCount} admin user(s)!`);
    console.log('\nAdmin users can login at: http://localhost:3000/login');
  }

  console.log('');
}

main().catch(console.error);
