import { Injectable } from '@nestjs/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import * as bcrypt from 'bcrypt';

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
	protected readonly configService: ConfigService;
	protected readonly saltRounds: number;
	protected readonly clientBaseUrl: string;

	constructor() {
		super();
		this.configService = new ConfigService();
		this.saltRounds = this.configService.get('USER_PASSWORD_BCRYPT_SALT_ROUNDS') as number;
		this.clientBaseUrl = this.configService.get('clientBaseUrl') as Extract<keyof IEnvironment, string>;
	}

	public validateOAuthLoginEmail(args: []): any { }

	/**
	 * Generate a hash for the provided password.
	 *
	 * @param password - The password to hash.
	 * @returns A promise that resolves to the hashed password.
	 */
	public async getPasswordHash(password: string): Promise<string> {
		try {
			return await bcrypt.hash(password, this.saltRounds);
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
	async routeRedirect(success: boolean, auth: { jwt: string; userId: string }, res: any) {
		const { userId, jwt } = auth;

		const redirectPath = success ? `#/sign-in/success?jwt=${jwt}&userId=${userId}` : `#/auth/register`;
		const redirectUrl = `${this.clientBaseUrl}/${redirectPath}`;

		return res.redirect(redirectUrl);
	}
}
