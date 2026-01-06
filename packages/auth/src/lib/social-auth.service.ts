import { Injectable } from '@nestjs/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { scrypt, randomBytes, ScryptOptions } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify<string | Buffer, Buffer, number, ScryptOptions, Buffer>(scrypt);

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
	protected readonly clientBaseUrl: string;

	constructor() {
		super();
		this.configService = new ConfigService();
		this.clientBaseUrl = this.configService.get('clientBaseUrl') as Extract<keyof IEnvironment, string>;
	}

	public validateOAuthLoginEmail(args: []): any {}

	/**
	 * Generate a hash for the provided password using scrypt.
	 *
	 * @param password - The password to hash.
	 * @returns A promise that resolves to the hashed password.
	 */
	public async getPasswordHash(password: string): Promise<string> {
		try {
			const salt = randomBytes(16);
			const N = 16384;
			const r = 8;
			const p = 1;
			const keyLength = 64;

			const derivedKey = (await scryptAsync(password, salt, keyLength, { N, r, p })) as Buffer;

			// Format: $scrypt$N$r$p$salt$hash
			return ['$scrypt', N, r, p, salt.toString('hex'), derivedKey.toString('hex')].join('$');
		} catch (error) {
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
