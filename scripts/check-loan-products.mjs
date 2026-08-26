/**
 * Check Loan Products
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zouxakzclowsinofbnps.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvdXhha3pjbG93c2lub2ZibnBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0NTE5MywiZXhwIjoyMDk0NTIxMTkzfQ.wM7Lhmq9SpUUqFz-fWiqFM1XKHHoBNViksxd2qycKEk';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('🔍 Checking loan products...\n');
  
  const { data: products, error } = await supabase
    .from('loan_products')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  if (!products || products.length === 0) {
    console.log('❌ No loan products found!');
    console.log('\n💡 Members cannot apply for loans until loan products are created.');
    console.log('\nTo create loan products:');
    console.log('1. Login as admin at http://localhost:3000/login');
    console.log('2. Scroll to "Loan Product Management" section');
    console.log('3. Fill in the "Create Loan Product" form');
    console.log('4. Click "Save Product"');
  } else {
    console.log(`✅ Found ${products.length} loan product(s)\n`);
    console.log('─'.repeat(60));
    
    products.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Status: ${p.is_active ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Interest: ${p.interest_rate_default}% (${p.interest_rate_min}% - ${p.interest_rate_max}%)`);
      console.log(`   Amount: UGX ${Number(p.principal_min).toLocaleString()} - ${Number(p.principal_max).toLocaleString()}`);
      console.log(`   Term: ${p.term_min_months} - ${p.term_max_months} months`);
      console.log(`   Savings Multiplier: ${p.savings_multiplier}x`);
    });
    
    console.log('\n' + '─'.repeat(60));
    
    const activeCount = products.filter(p => p.is_active).length;
    if (activeCount === 0) {
      console.log('\n⚠️  No ACTIVE loan products! Members can only see active products.');
      console.log('Activate products in admin dashboard → Loan Product Management');
    } else {
      console.log(`\n✅ ${activeCount} active product(s) available for members to apply`);
    }
  }
  
  console.log('');
}

main().catch(err => {
  console.error('\n💥 Error:', err.message);
  process.exit(1);
});
