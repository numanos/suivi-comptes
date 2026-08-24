import { NextResponse } from 'next/server';
import { destroyCurrentSession, SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  await destroyCurrentSession();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
