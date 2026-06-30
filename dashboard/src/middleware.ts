import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/app/dashboard', '/app/admin'];
const authPaths = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and API routes (APIs handle auth themselves)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('sb:token')?.value;

  const isAuthenticated = Boolean(sessionCookie);

  // Redirect authenticated users away from login
  if (isAuthenticated && authPaths.some(p => pathname === p)) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
  }

  // Protect dashboard routes
  if (protectedPaths.some(p => pathname.startsWith(p)) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  // Security headers complementares
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
