import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Profile, Strategy, StrategyOptionsWithRequest } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(protected readonly configService: ConfigService) {
		super(parseGithubConfig(configService));
	}

	/**
	 * Validate user profile after OAuth2 authentication.
	 * @param _request - The Express request object.
	 * @param _accessToken - The access token obtained from the OAuth2 provider.
	 * @param _refreshToken - The refresh token obtained from the OAuth2 provider.
	 * @param profile - The user's profile information obtained from the OAuth2 provider.
	 *
	 * Passport contract (`@nestjs/passport`'s `PassportStrategy` mixin): the returned value is the user and a
	 * thrown error is the error; the mixin reports either one to passport's `done` exactly once, so this
	 * method never calls `done` itself (doing both reported every sign-in twice: a success, then a failure).
	 *
	 * @returns The user object built from the profile.
	 */
	async validate(_request: Request, _accessToken: string, _refreshToken: string, profile: Profile) {
		try {
			// Extract relevant information from the user's profile
			const { id: providerId, provider, emails, displayName, username, photos } = profile;

			// Extract first name and last name from the display name (null when the GitHub account has no name)
			const [firstName, lastName] = (displayName ?? '').split(' ');

			// Extract the user's profile picture
			const [photo] = photos;

			// With allRawEmails, each address keeps GitHub's own primary and verified flags. Only the primary address
			// is offered, as the token sign-in (verifyGithubToken) accepts only that one, and it signs in only when
			// GitHub reports it verified. A secondary address can stay verified on GitHub long after its owner lost it.
			const githubEmails: Array<{ value: string; primary?: boolean; verified?: boolean }> = emails ?? [];

			// Construct user object
			const user = {
				emails: githubEmails
					.filter(({ primary }) => primary === true)
					.map(({ value, verified }) => ({ value, verified: verified === true })),
				firstName,
				lastName,
				username,
				picture: photo?.value,
				providerId,
				provider
			};

			// The returned user is what passport authenticates
			return user;
		} catch (error) {
			// The thrown error is what passport reports as the authentication failure
			console.error('Error during Github OAuth validation:', error);
			throw error;
		}
	}
}

/**
 * Parses the GitHub OAuth configuration using the provided ConfigService.
 *
 * Retrieves the GitHub client ID, client secret, callback URL, user agent, and additional parameters
 * from the configuration. If any required configuration is missing, a warning is logged and defaults are applied.
 *
 * @param configService - An instance of the ConfigService to access application configuration.
 * @returns An object containing the GitHub OAuth configuration.
 */
export const parseGithubConfig = (configService: ConfigService): StrategyOptionsWithRequest => {
	const { clientId, clientSecret, callbackURL, userAgent } = {
		// Retrieve the GitHub client ID from the configuration.
		clientId: configService.get<string>('github.clientId'),
		// Retrieve the GitHub client Secret from the configuration.
		clientSecret: configService.get<string>('github.clientSecret'),
		// Retrieve the callback URL from the configuration.
		callbackURL: configService.get<string>('github.callbackURL'),
		// Retrieve the user agent from the configuration.
		userAgent: configService.get<string>('github.userAgent')
	};

	// Log a warning if any of the required configuration values are missing.
	if (!clientId || !clientSecret || !callbackURL) {
		console.warn('⚠️ GitHub OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Return the GitHub OAuth configuration object.
	return {
		// Use the retrieved clientID, or default to 'disabled' if not provided.
		clientID: clientId || 'disabled',
		// Use the retrieved clientSecret, or default to 'disabled' if not provided.
		clientSecret: clientSecret || 'disabled',
		// Use the retrieved callbackURL, or default to the API_BASE_URL (or localhost) plus the callback path.
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/github/callback`,
		// Include the request object in the callback.
		passReqToCallback: true,
		// Specify the scope for GitHub OAuth (read user data and user email).
		scope: ['read:user', 'user:email'],
		// Retrieve the GitHub user agent from the configuration.
		userAgent: userAgent,
		// Keep GitHub's primary and verified flags on every email, so sign-in can refuse an unverified primary address.
		allRawEmails: true
	};
};
