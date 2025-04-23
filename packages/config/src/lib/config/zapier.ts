import { registerAs } from '@nestjs/config';
import { IZapierConfig } from '@gauzy/common';

/**
 * Register Zapier OAuth configuration using @nestjs/config
 */
export default registerAs(
	'zapier',
	(): IZapierConfig => ({
		// Zapier OAuth Client ID
		clientId: process.env.GAUZY_ZAPIER_CLIENT_ID,

		// Zapier OAuth Client Secret
		clientSecret: process.env.GAUZY_ZAPIER_CLIENT_SECRET,

		// Zapier max auth codes
		maxAuthCodes: Number.parseInt(process.env.GAUZY_ZAPIER_MAX_AUTH_CODES) || 1000,

		// Zapier instance count
		instanceCount: Number.parseInt(process.env.GAUZY_ZAPIER_INSTANCE_COUNT) || 1,

		// Zapier allowed domains
		allowedDomains: (process.env.GAUZY_ZAPIER_ALLOWED_DOMAINS ?? '')
			.split(',')
			.map((d) => d.trim())
			.filter(Boolean),

		// Zapier Redirected URI after successful authentication
		redirectUri: process.env.GAUZY_ZAPIER_REDIRECT_URL || '',

		// Zapier post install URL
		postInstallUrl:
			process.env.GAUZY_ZAPIER_POST_INSTALL_URL ??
			`${process.env.CLIENT_BASE_URL ?? ''}/#/pages/integrations/zapier`
	})
);
