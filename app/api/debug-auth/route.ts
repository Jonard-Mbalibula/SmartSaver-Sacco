import { NextResponse } from 'next/server';
import { createSupabaseAuthClient, createSupabaseServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    // Get user from auth client
    const auth = await createSupabaseAuthClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        error: authError?.message || 'No user'
      });
    }
    
    // Get profile from database
    const db = createSupabaseServerClient();
    const { data: profile, error: profileError } = await db
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: profile || null,
      profileError: profileError?.message || null
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
