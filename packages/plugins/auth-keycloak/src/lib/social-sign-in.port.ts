/**
 * The part of Gauzy's social sign-in the Keycloak routes use. It is provided by the core
 * authentication service, the same one the Google, GitHub and Microsoft routes use.
 */
export interface SocialSignInPort {
	/**
	 * Finds the Gauzy user that owns one of the verified addresses and issues its token.
	 */
	validateOAuthLoginEmail(
		emails: Array<{ value: string; verified: boolean }>
	): Promise<{ success: boolean; authData: { jwt: string; userId: string } }>;

	/**
	 * Redirects to the sign-in success page, or to the register page when no user matched.
	 */
	routeRedirect(success: boolean, auth: { jwt: string; userId: string }, res: unknown): Promise<unknown>;
}

/** Injection token of {@link SocialSignInPort}. */
export const SOCIAL_SIGN_IN = 'GAUZY_KEYCLOAK_SOCIAL_SIGN_IN';
