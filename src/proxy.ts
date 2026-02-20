import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('auth');
  
  const isAuthPage = request.nextUrl.pathname === '/';
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard') || 
                       request.nextUrl.pathname.startsWith('/budget') ||
                       request.nextUrl.pathname.startsWith('/patrimoine');

  // If trying to access dashboard without auth, redirect to login
  if (isDashboard && !authCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If already logged in and trying to access login, redirect to dashboard
  if (isAuthPage && authCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/budget/:path*', '/patrimoine/:path*']
};
