import { registerAs } from '@nestjs/config';
import { IActivepiecesConfig } from '@gauzy/common';

/**
 * Register ActivePieces configuration using @nestjs/config
 */
export default registerAs(
	'activepieces',
	(): IActivepiecesConfig => ({
		// Activepieces API Keys
		apiKey: process.env.GAUZY_ACTIVEPIECES_API_KEY ?? ''
	})
);
