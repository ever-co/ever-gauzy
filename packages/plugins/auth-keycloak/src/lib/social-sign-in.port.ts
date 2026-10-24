/**
 * The part of Gauzy's social sign-in the Keycloak routes use. It is provided by the core
 * authentication service, the same one the Google, GitHub and Microsoft routes use.
 */
export interface SocialSignInPort {
	/**
	 * Finds the Gauzy user that owns one of the verified addresses and issues its token. Only an account that has
	 * confirmed the address matches; when several do, `workspaces` carries the workspace picker's sign-in code instead.
	 */
	validateOAuthLoginEmail(emails: Array<{ value: string; verified: boolean }>): Promise<{
		success: boolean;
		authData: { jwt: string; userId: string; workspaces?: { email: string; code: string } };
	}>;

	/**
	 * Redirects to the sign-in success page, to the workspace picker when several accounts matched, or to the
	 * register page when no user matched.
	 */
	routeRedirect(
		success: boolean,
		auth: { jwt: string; userId: string; workspaces?: { email: string; code: string } },
		res: unknown
	): Promise<unknown>;
}

/** Injection token of {@link SocialSignInPort}. */
export const SOCIAL_SIGN_IN = 'GAUZY_KEYCLOAK_SOCIAL_SIGN_IN';
