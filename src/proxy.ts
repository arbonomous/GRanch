import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    const nextTarget = `${pathname}${search}`;
    if (nextTarget && nextTarget !== '/') {
      loginUrl.searchParams.set('next', nextTarget);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect all UI routes while letting API routes handle their own JSON 401/403 responses
     * and letting Next.js static/PWA assets load normally.
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|robots\\.txt|icon\\.svg|icon-512\\.png).*)',
  ],
};
