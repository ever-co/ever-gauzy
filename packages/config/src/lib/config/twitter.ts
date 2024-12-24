import { registerAs } from '@nestjs/config';
import { ITwitterConfig } from '@gauzy/common';

/**
 * Register Twitter OAuth configuration using @nestjs/config
 */
export default registerAs('twitter', (): ITwitterConfig => ({
    // Twitter API Key (Consumer Key)
    consumerKey: process.env.TWITTER_CLIENT_ID,

    // Twitter API Secret Key (Consumer Secret)
    consumerSecret: process.env.TWITTER_CLIENT_SECRET,

    // Callback URL for handling the OAuth response after authentication
    callbackURL: process.env.TWITTER_CALLBACK_URL || `${process.env.API_BASE_URL}/api/auth/twitter/callback`
}));
