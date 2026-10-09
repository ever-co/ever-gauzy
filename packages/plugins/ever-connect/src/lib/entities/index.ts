import { EverInstance } from '@gauzy/plugin-ever-instance';
import { EverConnectAudit } from './ever-connect-audit.entity';
import { EverConnectConnection } from './ever-connect-connection.entity';
import { EverConnectIntegration } from './ever-connect-integration.entity';
import { EverConnectLink } from './ever-connect-link.entity';
import { EverConnectLookupCache } from './ever-connect-lookup-cache.entity';
import { EverConnectPolicy } from './ever-connect-policy.entity';

export * from './ever-connect-audit.entity';
export * from './ever-connect-connection.entity';
export * from './ever-connect-integration.entity';
export * from './ever-connect-link.entity';
export * from './ever-connect-lookup-cache.entity';
export * from './ever-connect-policy.entity';

/** Every entity the plugin registers. Their tables are created by core migrations. */
export const EVER_CONNECT_ENTITIES = [
	EverInstance,
	EverConnectConnection,
	EverConnectLink,
	EverConnectIntegration,
	EverConnectPolicy,
	EverConnectAudit,
	EverConnectLookupCache
];
