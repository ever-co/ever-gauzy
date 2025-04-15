import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ID } from '@gauzy/contracts';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZapierAuthCodeService {
    private readonly logger = new Logger(ZapierAuthCodeService.name);
    private readonly MAX_AUTH_CODES: number;
    private readonly AUTH_CODE_EXPIRATION_MINUTES = 60; // Auth code expiration time in minutes
    private readonly ALLOWED_DOMAINS: string[];
    constructor(
        private readonly _config: ConfigService
    ) {
        this.MAX_AUTH_CODES = this._config.get<number>('zapier.maxAuthCodes') || 1000;
        const configDomains = this._config.get<string>('zapier.allowedDomains');
        const defaultDomains = [
            'localhost'
        ];
        if (configDomains) {
            this.ALLOWED_DOMAINS = [...new Set([
                ...defaultDomains,
                ...configDomains.split(',').map(domain => domain.trim())
            ])];
        } else {
            this.ALLOWED_DOMAINS = defaultDomains;
        }
        this.logger.log(`Initialized with allowed domains: ${this.ALLOWED_DOMAINS.join(', ')}`);
        this.startPeriodicCleanup();
    }

    // Using a Map to store temporary auth codes - this is temporary storage
    // and doesn't need to be persisted to the database
    private authCodes: Map<string, {
        userId: string,
        expiresAt: Date,
        tenantId: string,
        organizationId?: string,
        redirectUri?: string
    }> = new Map();

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
            this.logger.warn(`Rejected invalid redirect domain: ${redirectUri}`);
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
    getUserInfoFromAuthCode(code: string, redirectUri?: string): {
        userId: string,
        tenantId: string,
        organizationId?: string,
        redirectUri?: string
    } | null {
        const authCodeData = this.authCodes.get(code);

        // Check if code exists and is not expired
        if (authCodeData && authCodeData.expiresAt > new Date()) {
            if (authCodeData.redirectUri && redirectUri && authCodeData.redirectUri !== redirectUri) {
                this.logger.warn(`Redirect URI mismatch for auth code ${code}. Expected: ${authCodeData.redirectUri}, Received: ${redirectUri}`);
                this.logger.debug(`Auth Code Data: ${JSON.stringify(authCodeData)}`);
                throw new BadRequestException('Redirect URI mismatch');
            }
            this.authCodes.delete(code);

            return {
                userId: authCodeData.userId,
                tenantId: authCodeData.tenantId,
                organizationId: authCodeData.organizationId
            };
        }
        if (!authCodeData) {
            this.logger.debug('This could indicate an expired code that was already cleaned up or an invalid code attempt');
        } else {
            this.logger.debug(`Current time: ${new Date()}, expired ${(new Date().getTime() - authCodeData.expiresAt.getTime()) / 1000} seconds ago`);
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
        const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes
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

            // Check against allowed domains list
            return this.ALLOWED_DOMAINS.some(allowedDomain =>
                domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
            );
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
}
