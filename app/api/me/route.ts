import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ detail: 'Sign in required' }, { status: 401 });

  const login =
    user.primaryEmailAddress?.emailAddress ??
    user.username ??
    [user.firstName, user.lastName].filter(Boolean).join(' ') ??
    user.id;

  return NextResponse.json(
    { id: user.id, login },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
