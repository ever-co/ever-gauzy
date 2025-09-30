/**
 * Interface for ActivePieces Integration Configuration
 */
export interface IActivepiecesConfig {
	/**
	 * OAuth client ID for the tenant's ActivePieces application
	 */
	readonly clientId: string;

	/**
	 * OAuth client secret for the tenant's ActivePieces application
	 */
	readonly clientSecret: string;

	/**
	 * Callback URL for OAuth flow (optional, falls back to global config)
	 */
	readonly callbackUrl?: string;

	/**
	 * Post-installation redirect URL (optional, falls back to global config)
	 */
	readonly postInstallUrl?: string;

	/**
	 * Whether this configuration is active and should be used
	 */
	readonly isActive?: boolean;

	/**
	 * Optional description for the configuration
	 */
	readonly description?: string;

	/**
	 * Secret for signing OAuth state parameter
	 */
	readonly stateSecret?: string;
}
