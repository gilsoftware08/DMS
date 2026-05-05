// filepath: app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.userId,
        name: session.name,
        userId: session.userIdString,
        role: session.role,
      },
    });
  } catch (error) {
    console.error('Auth Me Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}