import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { environment } from '@gauzy/config';

/**
 * Base class for social authentication.
 */
export abstract class BaseSocialAuth {
	/**
	 * Validate OAuth login email.
	 *
	 * @param args - Arguments for validating OAuth login email.
	 * @returns The result of the validation.
	 */
	public abstract validateOAuthLoginEmail(args: []): any;
}

@Injectable()
export class SocialAuthService extends BaseSocialAuth {
	constructor() {
		super();
	}

	/**
	 * Validate the email provided during OAuth login.
	 *
	 * @param args - An array containing the email to validate.
	 * @returns An object indicating whether the email is valid and an optional message.
	 */
	public validateOAuthLoginEmail(args: []): any {}

	/**
	 * Generate a hash for the provided password.
	 *
	 * @param password - The password to hash.
	 * @returns A promise that resolves to the hashed password.
	 */
	public async getPasswordHash(password: string): Promise<string> {
		try {
			// Generate bcrypt hash using provided password and salt rounds from environment
			const salt = await bcrypt.genSalt(environment.USER_PASSWORD_BCRYPT_SALT_ROUNDS);
			// Use bcrypt to hash the password
			return await bcrypt.hash(password, salt);
		} catch (error) {
			// Handle the error appropriately, e.g., log it or throw a custom error
			console.error('Error in getPasswordHash:', error);
			throw new Error('Failed to hash the password');
		}
	}

	/**
	 * Redirect the user based on the success status.
	 *
	 * @param success - Indicates whether the operation was successful.
	 * @param auth - Object containing JWT and userId.
	 * @param res - Express response object.
	 * @returns The redirect response.
	 */
	async routeRedirect(success: boolean, auth: { jwt: string; userId: string }, res: Response) {
		const { userId, jwt } = auth;

		// Construct the redirect path based on success status
		const redirectPath = success
			? `#/sign-in/success?jwt=${encodeURIComponent(jwt)}&userId=${encodeURIComponent(userId)}`
			: '#/auth/register';

		// Construct the redirect URL
		const redirectUrl = `${environment.clientBaseUrl}/${redirectPath}`;

		return res.redirect(redirectUrl);
	}
}
