import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ID } from '@gauzy/contracts';

@Injectable()
export class ZapierAuthCodeService {
	private readonly logger = new Logger(ZapierAuthCodeService.name);
	private readonly MAX_AUTH_CODES: number;
	private readonly AUTH_CODE_EXPIRATION_MINUTES = 60; // Auth code expiration time in minutes
	private readonly ALLOWED_DOMAINS: string[];
	// Using a Map to store temporary auth codes - this is temporary storage
	// and doesn't need to be persisted to the database
	private authCodes: Map<
		string,
		{
			userId: string;
			expiresAt: Date;
			tenantId: string;
			organizationId?: string;
			redirectUri?: string;
		}
	> = new Map();

	constructor(private readonly _config: ConfigService) {
		// Retrieve the maximum number of auth codes, defaulting to 1000 if not set
		this.MAX_AUTH_CODES = Number(this._config.get<number>('zapier.maxAuthCodes')) || 1000;

		// Define default allowed domains
		const defaultDomains = ['localhost'];

		// Retrieve and process allowed domains from configuration
		const configDomains = this._config.get<string>('zapier.allowedDomains');
		this.ALLOWED_DOMAINS = configDomains
			? Array.from(new Set([...defaultDomains, ...configDomains.split(',').map((domain) => domain.trim())]))
			: defaultDomains;

		this.logger.log(`Initialized with allowed domains: ${this.ALLOWED_DOMAINS.join(', ')}`);

		// Determine deployment type and initiate periodic cleanup accordingly
		if (this.isSingleInstanceDeployment()) {
			this.startPeriodicCleanup();
		} else {
			this.logger.warn(
				'Periodic cleanup is disabled in multi-instance deployments. Consider using distributed storage.'
			);
		}
	}

	/**
	 * Generates and stores an authentication code for a user
	 *
	 * @param userId The user's ID
	 * @param tenantId The tenant ID
	 * @param organizationId The organization ID
	 * @param redirectUri The redirect URI (optional)
	 * @returns The generated authorization code
	 */
	generateAuthCode(userId: ID, tenantId: ID, organizationId?: ID, redirectUri?: string): string {
		// Generation of a unique code
		const code = uuidv4();
		// Auth codes expire in 60 minutes
		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + this.AUTH_CODE_EXPIRATION_MINUTES);

		// Validate the redirect URI if provided
		if (redirectUri && !this.isValidRedirectDomain(redirectUri)) {
			const url = new URL(redirectUri);
			const domain = url.hostname;

			this.logger.warn(`Rejected invalid redirect domain: ${redirectUri}`, {
				attemptedDomain: domain,
				allowedDomains: this.ALLOWED_DOMAINS,
				subdomainConstraints: 'Only first-level subdomains are allowed for listed domains'
			});

			throw new BadRequestException('Invalid redirect URI domain');
		}

		if (this.authCodes.size >= this.MAX_AUTH_CODES) {
			this.logger.warn(`Maximum auth code limit (${this.MAX_AUTH_CODES}) reached. Cleaning up expired codes.`);
			this.cleanupExpiredAuthCodes();

			// If still at limit after cleanup, throw error
			if (this.authCodes.size >= this.MAX_AUTH_CODES) {
				throw new ServiceUnavailableException('Maximum auth code limit reached. Please try again later.');
			}
		}

		// Stores the code with user infos
		this.authCodes.set(code, {
			userId: userId.toString(),
			tenantId: tenantId.toString(),
			organizationId: organizationId?.toString(),
			redirectUri,
			expiresAt
		});
		this.logger.debug(`Generated auth code for user ${userId}, expires at ${expiresAt}`);
		return code;
	}

	/**
	 * Gets the user information associated with an auth code
	 *
	 * @param code The authorization code
	 * @returns The user info or null if code is invalid or expired
	 */
	getUserInfoFromAuthCode(
		code: string,
		redirectUri?: string
	): {
		userId: string;
		tenantId: string;
		organizationId?: string;
		redirectUri?: string;
	} | null {
		const authCodeData = this.authCodes.get(code);

		// Check if code exists and is not expired
		if (authCodeData && authCodeData.expiresAt > new Date()) {
			if (authCodeData.redirectUri && redirectUri && authCodeData.redirectUri !== redirectUri) {
				const errorMessage = `Redirect URI mismatch for auth code ${code}. Expected: ${authCodeData.redirectUri}, Received: ${redirectUri}`;
				this.logger.warn(errorMessage);
				this.logger.debug(`Auth Code Data: ${JSON.stringify(authCodeData)}`);
				throw new BadRequestException({
					statusCode: 400,
					message: 'Redirect URI mismatch',
					details: errorMessage
				});
			}
			this.authCodes.delete(code);

			return {
				userId: authCodeData.userId,
				tenantId: authCodeData.tenantId,
				organizationId: authCodeData.organizationId
			};
		}
		if (!authCodeData) {
			this.logger.debug(
				'This could indicate an expired code that was already cleaned up or an invalid code attempt'
			);
		} else {
			this.logger.debug(
				`Current time: ${new Date()}, expired ${
					(new Date().getTime() - authCodeData.expiresAt.getTime()) / 1000
				} seconds ago`
			);
		}
		return null;
	}

	private cleanupExpiredAuthCodes(): void {
		const now = new Date();
		for (const [code, data] of this.authCodes.entries()) {
			if (data.expiresAt < now) {
				this.authCodes.delete(code);
				this.logger.debug(`Removed expired auth code: ${code}`);
			}
		}
	}

	/**
	 * Starts a periodic cleanup process to remove expired auth codes
	 */
	private startPeriodicCleanup(): void {
		// Cleanup every 5 minutes
		const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

		setInterval(() => {
			this.logger.debug('Running periodic cleanup of expired auth codes');
			this.cleanupExpiredAuthCodes();
		}, CLEANUP_INTERVAL_MS);
	}

	/**
	 * Validates if a redirect URI belongs to an allowed domain
	 */
	private isValidRedirectDomain(redirectUri: string): boolean {
		try {
			if (!redirectUri) return false;

			const url = new URL(redirectUri);
			const domain = url.hostname;

			// Always allow localhost for development
			if (domain === 'localhost' || domain.endsWith('.localhost')) {
				return true;
			}

			// Validate subdomains with more flexibility for nested levels
			const isSubdomain = (allowedDomain: string) => {
				const allowedParts = allowedDomain.split('.').reverse();
				const domainParts = domain.split('.').reverse();

				// Ensure the allowed domain matches the end of the provided domain
				return allowedParts.every((part, index) => domainParts[index] === part);
			};

			// Check against allowed domains list with flexible subdomain validation
			return this.ALLOWED_DOMAINS.some((allowedDomain) => domain === allowedDomain || isSubdomain(allowedDomain));
		} catch (error) {
			this.logger.error(`Invalid redirect URI format: ${redirectUri}`, error);
			return false;
		}
	}
	/**
	 * Get the current server domain from a request
	 * This can be used as an alternative approach to get the current domain
	 */
	getServerDomainFromRequest(request: any): string | null {
		try {
			if (!request || !request.headers) {
				return null;
			}

			// Get domain from host header
			const host = request.headers.host || '';

			// Remove port if present
			return host.split(':')[0];
		} catch (error) {
			this.logger.error('Failed to get server domain from request', error);
			return null;
		}
	}

	/**
	 * Determines if the application is running in a single-instance deployment
	 */
	private isSingleInstanceDeployment(): boolean {
		const instanceCountRaw = this._config.get<string>('zapier.instanceCount');

		if (instanceCountRaw === undefined) {
			return true; // Default to single-instance if not defined
		}

		const normalized = instanceCountRaw.trim().toLowerCase();

		if (normalized === 'true') {
			return true;
		}

		if (normalized === 'false') {
			return false;
		}

		const parsedCount = Number.parseInt(normalized, 10);
		if (!isNaN(parsedCount)) {
			return parsedCount === 1;
		}

		throw new Error(
			`Invalid zapier.instanceCount value: "${instanceCountRaw}". Must be a boolean ("true"/"false") or a numeric string.`
		);
	}
}
