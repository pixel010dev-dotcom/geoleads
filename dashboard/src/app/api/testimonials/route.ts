import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('testimonials')
      .select('name, rating, feedback, role, created_at')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[TESTIMONIALS] Fetch error:', error);
      return NextResponse.json({ testimonials: [] });
    }

    return NextResponse.json({ testimonials: data || [] });
  } catch (err) {
    console.error('[TESTIMONIALS] Error:', err);
    return NextResponse.json({ testimonials: [] });
  }
}
