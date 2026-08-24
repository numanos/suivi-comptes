import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get('session');
  
  const isAuthPage = request.nextUrl.pathname === '/';
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard') || 
                       request.nextUrl.pathname.startsWith('/budget') ||
                       request.nextUrl.pathname.startsWith('/patrimoine');
  const isApi = request.nextUrl.pathname.startsWith('/api/') &&
    !request.nextUrl.pathname.startsWith('/api/auth/login') &&
    !request.nextUrl.pathname.startsWith('/api/auth/logout');

  if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // If trying to access dashboard without auth, redirect to login
  if ((isDashboard || isApi) && !authCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If already logged in and trying to access login, redirect to dashboard
  if (isAuthPage && authCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ['/', '/dashboard/:path*', '/budget/:path*', '/patrimoine/:path*', '/api/:path*']
};
