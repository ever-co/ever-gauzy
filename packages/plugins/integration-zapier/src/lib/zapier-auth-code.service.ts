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

		// Retrieve and merge allowed domains from configuration
		const configDomains = this._config.get<string[]>('zapier.allowedDomains', []);

		// Merge with defaults and dedupe
		this.ALLOWED_DOMAINS = Array.from(
			new Set([...defaultDomains, ...configDomains.map((domain) => domain.trim()).filter(Boolean)])
		);

		// (Optional) Log the final list
		this.logger.debug(`Initialized with allowed domains: ${this.ALLOWED_DOMAINS.join(', ')}`);

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
	 * Generates and stores a time‑limited authorization code for a user.
	 *
	 * @param userId         The user’s unique identifier.
	 * @param tenantId       The tenant’s unique identifier.
	 * @param organizationId (Optional) The organization’s unique identifier.
	 * @param redirectUri    (Optional) The URI to which the user will be redirected—must match an allowed domain.
	 * @returns The newly generated auth code.
	 * @throws BadRequestException         If a provided redirectUri doesn’t match an allowed domain.
	 * @throws ServiceUnavailableException If the in‑memory store has reached its max capacity.
	 */
	generateAuthCode(userId: ID, tenantId: ID, organizationId?: ID, redirectUri?: string): string {
		// 1) Prepare IDs and timestamps
		const userIdStr = userId.toString();
		const tenantIdStr = tenantId.toString();
		const orgIdStr = organizationId?.toString();
		const code = uuidv4();
		const expiresAt = new Date(Date.now() + this.AUTH_CODE_EXPIRATION_MINUTES * 60_000);

		// 2) Validate redirect URI (if provided)
		if (redirectUri && !this.isValidRedirectDomain(redirectUri)) {
			const hostname = new URL(redirectUri).hostname;

			this.logger.warn(`Rejected invalid redirect domain: ${redirectUri}`, {
				attemptedDomain: hostname,
				allowedDomains: this.ALLOWED_DOMAINS,
				subdomainConstraints: 'Only first-level subdomains are allowed for listed domains'
			});

			throw new BadRequestException('Invalid redirect URI domain');
		}

		// 3) Ensure we haven’t exceeded our in‑memory capacity
		this.ensureAuthCodeCapacity();

		// 4) Store the auth code
		this.authCodes.set(code, {
			userId: userIdStr,
			tenantId: tenantIdStr,
			organizationId: orgIdStr,
			redirectUri,
			expiresAt
		});

		this.logger.debug(`Generated auth code ${code} (user=${userIdStr}, expires=${expiresAt.toISOString()})`);

		return code;
	}

	/**
	 * Ensures there is capacity to store a new auth code,
	 * cleaning up expired codes if necessary, and throws
	 * if the limit is still reached.
	 */
	private ensureAuthCodeCapacity(): void {
		if (this.authCodes.size < this.MAX_AUTH_CODES) {
			return;
		}

		this.logger.warn(`Max auth codes reached (${this.MAX_AUTH_CODES}). Running cleanup.`);
		this.cleanupExpiredAuthCodes();

		if (this.authCodes.size >= this.MAX_AUTH_CODES) {
			throw new ServiceUnavailableException('Maximum auth code limit reached. Please try again later.');
		}
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
		userId: ID;
		tenantId: ID;
		organizationId?: ID;
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
		const instanceCountRaw = this._config.get<boolean | number | string>('zapier.instanceCount');

		if (instanceCountRaw === undefined) {
			return true; // Default to single-instance if not defined
		}

		const normalized = String(instanceCountRaw).trim().toLowerCase();

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
