import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { ID } from '@gauzy/contracts';

@Injectable()
export class ZapierAuthCodeService {
    private readonly logger = new Logger(ZapierAuthCodeService.name);

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

    generateAuthCode(userId: ID, tenantId: ID, organizationId?: ID): String {
        // Generation of a unique code
        const code = uuidv4();
        // Auth codes expire in 60 minutes
        const expiresAt = moment().add(60, 'minutes').toDate();

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
        return null;
    }
}
