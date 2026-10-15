// Existing administrator identities verified against Firebase Authentication before deployment.
// Future administrators need a trusted Admin SDK custom claim; a profile field alone is insufficient.
export const trustedAdminUids = ["3nJNAflYMQNmBynY7y1608lLNSG2", "Ckw0U3jPOqewRO8AqrtDe8OWo6q2"] as const;
export function trustedAdministrator(uid: string, claims: Record<string, unknown>) {
  return claims.admin === true || (trustedAdminUids as readonly string[]).includes(uid);
}
