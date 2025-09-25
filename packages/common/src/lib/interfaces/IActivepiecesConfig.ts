/**
 * Interface for ActivePieces Integration Configuration entity
 * Stores tenant-specific OAuth credentials for ActivePieces integration
 */
export interface IActivepiecesConfig {
	/**
	 * OAuth client ID for the tenant's ActivePieces application
	 */
	clientId: string;

	/**
	 * OAuth client secret for the tenant's ActivePieces application
	 */
	clientSecret: string;

	/**
	 * Callback URL for OAuth flow (optional, falls back to global config)
	 */
	callbackUrl?: string;

	/**
	 * Post-installation redirect URL (optional, falls back to global config)
	 */
	postInstallUrl?: string;

	/**
	 * Whether this configuration is active and should be used
	 */
	isActive?: boolean;

	/**
	 * Optional description for the configuration
	 */
	description?: string;
}
