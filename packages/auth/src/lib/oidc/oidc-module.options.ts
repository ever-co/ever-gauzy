/** Injection token of {@link OidcModuleOptions}. */
export const OIDC_MODULE_OPTIONS = 'GAUZY_OIDC_MODULE_OPTIONS';

/** Settings of the OIDC library. */
export interface OidcModuleOptions {
	/**
	 * Secret the transaction cookie is signed with. The library never signs with it directly: it
	 * derives a dedicated key from it, so a transaction cookie can never be mistaken for any other
	 * token signed by the platform.
	 */
	transactionSecret: string;
}
