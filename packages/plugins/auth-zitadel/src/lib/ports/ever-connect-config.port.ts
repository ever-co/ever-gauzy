/**
 * Optional port through which a connected-instance plugin can hand this plugin its issuer and client,
 * and say whether the person-facing Ever ID sign-in integration is enabled for the instance.
 *
 * Nothing provides it yet; while it is absent the plugin reads its settings from the environment
 * only, and an issuer on an Ever host is never used on a non-cloud install.
 */
export interface EverConnectConfigPort {
	/** Issuer and client for the Ever ID sign-in integration, or `null` when not configured. */
	getEverIdLoginConfig(): Promise<{ issuer: string; clientId: string; clientSecret: string } | null>;

	/** Whether the Ever ID sign-in integration is enabled and consented for this instance. */
	isEverIdLoginEnabled(): Promise<boolean>;
}

/** Injection token of {@link EverConnectConfigPort}. Declared here; provided elsewhere, never imported from there. */
export const EVER_CONNECT_CONFIG = 'EVER_CONNECT_CONFIG';
