import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Redirect while preserving Supabase auth cookies set during this request
function createRedirect(url: URL, supabaseResponse: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value);
  });
  return redirect;
}

export async function proxy(request: NextRequest) {
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

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith('/auth');
  const isLoginPage = path === '/login';

  // Helper: build correct origin behind Replit reverse proxy
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;

  if (!user) {
    if (!isLoginPage && !isAuthRoute) {
      return createRedirect(new URL('/login', origin), supabaseResponse);
    }
    return supabaseResponse;
  }

  // User is authenticated — check they have an active UserProfile (invite-only gate)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_active, role, member_status, must_change_password')
    .eq('user_id', user.id)
    .single();

  const isChangePasswordPage = path === '/change-password';

  if (!profile || !profile.is_active) {
    // Authenticated but not yet activated — show pending page
    if (!isLoginPage && !isAuthRoute && path !== '/pending') {
      return createRedirect(new URL('/pending', origin), supabaseResponse);
    }
    return supabaseResponse;
  }

  // Redirect active users away from login and pending pages
  if (isLoginPage || path === '/pending') {
    return createRedirect(new URL('/', origin), supabaseResponse);
  }

  // First-login forced password change
  if (profile.must_change_password) {
    // Allow the change-password page itself and its API route through
    const isChangePasswordApi = path.startsWith('/api/');
    console.log(`[proxy] must_change_password=true path=${path} isChangePasswordPage=${isChangePasswordPage} isApi=${isChangePasswordApi}`);
    if (!isChangePasswordPage && !isChangePasswordApi) {
      return createRedirect(new URL('/change-password', origin), supabaseResponse);
    }
    return supabaseResponse;
  }

  // Password already changed — redirect away from change-password page
  if (isChangePasswordPage) {
    return createRedirect(new URL('/', origin), supabaseResponse);
  }

  // Attach role to request headers for use in Server Components
  supabaseResponse.headers.set('x-user-role', profile.role);
  supabaseResponse.headers.set('x-member-status', profile.member_status);

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
