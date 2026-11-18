import type { AuthError } from "@supabase/supabase-js";

import type { MessageKey } from "../i18n";

/** Picks the message (by key) that explains a Supabase auth error to a person. */
export function authErrorKey(error: AuthError): MessageKey {
  switch (error.code) {
    case "invalid_credentials":
      return "authErr.invalidCredentials";
    case "email_not_confirmed":
      return "authErr.emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "authErr.exists";
    case "weak_password":
      return "authErr.weak";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "authErr.rateLimit";
    case "email_address_invalid":
    case "validation_failed":
      return "authErr.emailInvalid";
    case "signup_disabled":
      return "authErr.signupDisabled";
    default:
      break;
  }
  if (error.name === "AuthRetryableFetchError" || /network|fetch/i.test(error.message)) return "authErr.network";
  return "authErr.generic";
}
