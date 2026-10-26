import { registerAs } from '@nestjs/config';
import { IActivepiecesConfig } from '@gauzy/common';

/**
 * Register ActivePieces configuration using @nestjs/config
 */
export default registerAs(
	'activepieces',
	(): IActivepiecesConfig => ({
		// Activepieces API Keys
		apiKey: process.env.GAUZY_ACTIVEPIECES_API_KEY ?? '',
		// Signing key of the platform, for the tenants' project tokens (managed authentication)
		signingKeyId: process.env.GAUZY_ACTIVEPIECES_SIGNING_KEY_ID ?? '',
		signingPrivateKey: process.env.GAUZY_ACTIVEPIECES_SIGNING_PRIVATE_KEY ?? '',
		// Tenants without a key of their own use the platform key, confined to a project of their own
		tenantProjectsEnabled: !['false', '0', 'no', 'off'].includes(
			(process.env.GAUZY_ACTIVEPIECES_TENANT_PROJECTS ?? '').trim().toLowerCase()
		),
		projectExternalIdPrefix: process.env.GAUZY_ACTIVEPIECES_PROJECT_EXTERNAL_ID_PREFIX ?? '',
		// The MCP routes of the installation's Activepieces: `v2` (blank) or `legacy`; read where MCP is called
		mcpApi: process.env.GAUZY_ACTIVEPIECES_MCP_API ?? ''
	})
);
