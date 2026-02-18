import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Always use getUser() — never getSession() — for server-side token validation
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
  const isLoginPage = request.nextUrl.pathname === '/login';

  if (!user && !isLoginPage && !isAuthRoute) {
    // Redirect unauthenticated users to login
    // Use x-forwarded-host for correct redirect behind reverse proxy (Replit)
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;
    return NextResponse.redirect(new URL('/login', origin));
  }

  if (user) {
    // Domain check: only @testbusters.it accounts allowed
    const email = user.email ?? '';
    if (!email.endsWith('@testbusters.it')) {
      await supabase.auth.signOut();
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
      const origin = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : request.nextUrl.origin;
      return NextResponse.redirect(new URL('/login?error=unauthorized_domain', origin));
    }

    // Redirect authenticated users away from login
    if (isLoginPage) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
      const origin = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : request.nextUrl.origin;
      return NextResponse.redirect(new URL('/', origin));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
