import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { ID } from '@gauzy/contracts';

@Injectable()
export class ZapierAuthCodeService {
    private readonly logger = new Logger(ZapierAuthCodeService.name);
    private readonly MAX_AUTH_CODES = 1000; // Maximum number of auth codes to store

    // Using a Map to store temporary auth codes - this is temporary storage
    // and doesn't need to be persisted to the database
    private authCodes: Map<string, {
        userId: string,
        expiresAt: Date,
        tenantId: string,
        organizationId?: string
    }> = new Map();

    /**
     * Generates and stores an authentication code for a user
     *
     * @param userId The user's ID
     * @param tenantId The tenant ID
     * @param organizationId The organization ID
     * @returns The generated authorization code
     */

    generateAuthCode(userId: ID, tenantId: ID, organizationId?: ID): string {
        // Generation of a unique code
        const code = uuidv4();
        // Auth codes expire in 60 minutes
        const expiresAt = moment().add(60, 'minutes').toDate();

        if (this.authCodes.size >= this.MAX_AUTH_CODES) {
            this.logger.warn(`Maximum auth code limit (${this.MAX_AUTH_CODES}) reached. Cleaning up expired codes.`);
            this.cleanupExpiredAuthCodes();

            // If still at limit after cleanup, throw error
            if (this.authCodes.size >= this.MAX_AUTH_CODES) {
                throw new Error('Maximum auth code limit reached. Please try again later.');
            }
        }
        // Stores the code with user infos
        this.authCodes.set(code, {
            userId: userId.toString(),
            tenantId: tenantId.toString(),
            organizationId: organizationId?.toString(),
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
    getUserInfoFromAuthCode(code: string): {
        userId: string,
        tenantId: string,
        organizationId?: string
    } | null {
        const authCodeData = this.authCodes.get(code);

        // Check if code exists and is not expired
        if (authCodeData && moment().isBefore(authCodeData.expiresAt)) {
            this.authCodes.delete(code);

            return {
                userId: authCodeData.userId,
                tenantId: authCodeData.tenantId,
                organizationId: authCodeData.organizationId
            };
        }
        if (!authCodeData) {
            this.logger.debug(`Auth Code not found: ${code}`);
        } else {
            this.logger.debug(`Auth Code ${code} expired at ${authCodeData.expiresAt} `);
        }
        return null;
    }
    /**
     * Removes all expired auth codes from memory
     */
    private cleanupExpiredAuthCodes(): void {
        const now = new Date();
        setInterval(() => {
            for (const [code, data] of this.authCodes.entries()) {
                if (data.expiresAt < now) {
                    this.authCodes.delete(code);
                    this.logger.debug(`Removed expired auth code: ${code}`);
                }
            }
        }, 60000); // runs every minute
    }
}
