/**
 * Shim for BeatAPI's @/routes module.
 * Mirrors the BeatAPI routes.ts enum.
 */
export enum Routes {
  Root = '/',
  History = '/projects',
  PublicPricing = '/pricing',

  // public pages
  PrivacyPolicy = '/privacy-policy',
  TermsOfService = '/terms-of-service',

  // auth routes
  Login = '/auth/login',
  Register = '/auth/register',
  AuthError = '/auth/error',
  ForgotPassword = '/auth/forgot-password',
  ResetPassword = '/auth/reset-password',

  // product routes
  Studio = '/studio',
  Canvas = '/canvas',
  AdminUsers = '/admin/users',

  // payment processing
  Payment = '/payment',

  // Convenience aliases used by some config files
  HOME = '/',
  DASHBOARD = '/dashboard',
  SIGN_IN = '/sign-in',
  SIGN_UP = '/sign-up',
  PRICING = '/pricing',
  SETTINGS = '/settings',
}

export const routesNotAllowedByLoggedInUsers = [Routes.Login, Routes.Register];

export const protectedRoutes = [
  Routes.Studio,
  Routes.Canvas,
  Routes.AdminUsers,
  Routes.Payment,
];

export const DEFAULT_LOGIN_REDIRECT = Routes.Root;
