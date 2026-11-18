import type { AuthError } from "@supabase/supabase-js";

/** Turns a Supabase auth error into a short message a person can act on. */
export function friendlyAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "The email or password is not right. Please try again.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return "That password is too weak. Use at least 8 characters.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "email_address_invalid":
    case "validation_failed":
      return "That email address does not look right.";
    case "signup_disabled":
      return "New sign-ups are turned off right now.";
    default:
      break;
  }
  if (error.name === "AuthRetryableFetchError" || /network|fetch/i.test(error.message)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
