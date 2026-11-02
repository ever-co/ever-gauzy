/**
 * What Ever Platform says about an Ever ID identity, as far as this installation may know it (the
 * organizations and links of this installation only). Only the parts this plugin reads are named.
 */
export interface EverIdentityContext {
	person?: { id?: string | null } | null;
	identity?: { kind?: string | null; enterprise_org_id?: string | null } | null;
	orgs_filtered?: Array<{ id?: string | null; handle?: string | null; reason?: string | null }> | null;
}

/**
 * Optional port through which a connected-instance plugin can hand this plugin its issuer and client,
 * and say whether the person-facing Ever ID sign-in integration is enabled for the instance.
 *
 * The Ever Platform connection plugin (`@gauzy/plugin-ever-connect`) provides it when it is loaded;
 * while it is absent the plugin reads its settings from the environment only, and an issuer on an
 * Ever host is never used on a non-cloud install.
 */
export interface EverConnectConfigPort {
	/** Issuer and client for the Ever ID sign-in integration, or `null` when not configured. */
	getEverIdLoginConfig(): Promise<{ issuer: string; clientId: string; clientSecret: string } | null>;

	/** Whether the Ever ID sign-in integration is enabled and consented for this instance. */
	isEverIdLoginEnabled(): Promise<boolean>;

	/**
	 * Asks Ever Platform about an identity of its own issuer that this installation holds a link for
	 * (`POST /v1/identity/resolve`), for a token that carries none of the platform's `urn:ever:*`
	 * claims. `null` when the installation is not connected, the integration is off, the issuer is
	 * not Ever Platform's, or nothing is known; never throws for an answer it did not get.
	 */
	resolveIdentity?(issuer: string, subject: string, idToken?: string): Promise<EverIdentityContext | null>;
}

/** Injection token of {@link EverConnectConfigPort}. Declared here; provided elsewhere, never imported from there. */
export const EVER_CONNECT_CONFIG = 'EVER_CONNECT_CONFIG';
