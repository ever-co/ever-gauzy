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
