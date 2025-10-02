import { registerAs } from '@nestjs/config';
import { IActivepiecesConfig } from '@gauzy/common';

/**
 * Register ActivePieces configuration using @nestjs/config
 */
export default registerAs(
	'activepieces',
	(): IActivepiecesConfig => ({
        // ActivePieces OAuth Client ID
		clientId: process.env.GAUZY_ACTIVEPIECES_CLIENT_ID ?? '',

        // ActivePieces OAuth Client Secret
		clientSecret: process.env.GAUZY_ACTIVEPIECES_CLIENT_SECRET ?? '',

        // ActivePieces Redirected URI after successful authentication
		callbackUrl:
			process.env.GAUZY_ACTIVEPIECES_CALLBACK_URL ??
			`${process.env.API_BASE_URL ?? ''}/api/integration/activepieces/callback`,

        // ActivePieces post install URL
		postInstallUrl:
			process.env.GAUZY_ACTIVEPIECES_POST_INSTALL_URL ??
			`${process.env.CLIENT_BASE_URL ?? ''}/#/pages/integrations/activepieces`,

        // ActivePieces state secret
		stateSecret: process.env.ACTIVEPIECES_STATE_SECRET ?? '',
	})
);
