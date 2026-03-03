import { registerAs } from '@nestjs/config';
import { ISimConfig } from '@gauzy/common';

/**
 * Register SIM (Sim Studio) configuration using @nestjs/config
 */
export default registerAs(
	'sim',
	(): ISimConfig => ({
		// SIM API Key (optional global fallback)
		apiKey: process.env.GAUZY_SIM_API_KEY ?? ''
	})
);
