/**
 * Interface representing the response structure for email existence check.
 */
export interface IEmailCheckResponse {
	/**
	 * Indicates whether the provided email exists in the database.
	 */
	exists: boolean;
}

/**
 * Interface representing the request payload for email existence check.
 */
export interface IEmailCheckRequest {
	/**
	 * The email address to check in the database.
	 */
	email: string;
}

/**
 * Whether this server accepts new accounts through its public sign-up (`GET /api/auth/registration/config`).
 */
export interface IRegistrationConfig {
	/**
	 * False when the operator closed self-service registration (`APP_USER_REGISTRATION=false` or
	 * `ALLOW_TENANTS_REGISTRATION=false`). Invitations and accounts created by an administrator work either way.
	 */
	enabled: boolean;
}
