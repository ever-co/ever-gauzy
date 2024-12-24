import { registerAs } from '@nestjs/config';
import { ILinkedinConfig } from '@gauzy/common';

/**
 * Register LinkedIn OAuth configuration using @nestjs/config
 */
export default registerAs('linkedin', (): ILinkedinConfig => ({
    // LinkedIn OAuth Client ID
    clientId: process.env.LINKEDIN_CLIENT_ID,

    // LinkedIn OAuth Client Secret
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,

    // Callback URL for handling the OAuth response after authentication
    callbackURL: process.env.LINKEDIN_CALLBACK_URL || `${process.env.API_BASE_URL}/api/auth/linkedin/callback`
}));
