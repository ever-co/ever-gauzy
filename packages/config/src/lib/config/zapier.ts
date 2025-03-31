import { registerAs } from '@nestjs/config';
import { IZapierConfig } from '@gauzy/common';

/**
 * Register Zapier OAuth configuration using @nestjs/config
 */

export default registerAs (
    'zapier',
    (): IZapierConfig => ({
        // Zapier 0Auth Client ID
        clientId: process.env.GAUZY_ZAPIER_CLIENT_ID,

        // Zapier 0Auth Client Secret
		clientSecret: process.env.GAUZY_ZAPIER_CLIENT_SECRET,

        // Zapier Redirected URI after successful authentication
		redirectUri: process.env.GAUZY_ZAPIER_REDIRECT_URL,

        // Zapier post install URL
        postInstallUrl: process.env.ZAPIER_POST_INSTALL_URL
    })
)
