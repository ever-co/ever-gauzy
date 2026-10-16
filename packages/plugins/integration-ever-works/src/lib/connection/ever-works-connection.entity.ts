import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmEverWorksConnectionRepository } from './repository/mikro-orm-ever-works-connection.repository';

/** How the connection authenticates to Ever Works: an integration key now, an Ever ID token later (plan 02 §5). */
export enum EverWorksAuthMode {
	API_KEY = 'api_key',
	EVER_ID = 'ever_id'
}

/** The state of a connection (plan 02 §4). */
export enum EverWorksConnectionStatus {
	/** Validated and syncing. */
	ACTIVE = 'active',
	/** Paused by an admin: nothing is pulled or pushed. */
	PAUSED = 'paused',
	/** Ever Works answered 401 (the key was revoked or expired): paused until a new key is entered. */
	NEEDS_REAUTH = 'needs_reauth',
	/** The last health check failed for another reason (Ever Works unreachable, scopes withdrawn, …). */
	ERROR = 'error',
	/** Disconnected: archived with its links and logs, so a reconnect resumes without duplicates. */
	DISCONNECTED = 'disconnected'
}

/**
 * One Gauzy tenant's connection to one Ever Works tenant (plan 02 §4, 03 §C.1). Tenant-level: at most
 * one active row per tenant; `organizationId` is the organization it was connected from. Each mapped
 * Gauzy organization is an `integration_tenant` named `Ever_Works` that points at this row.
 *
 * The integration key and the webhook signing secret are stored ONLY encrypted
 * (`EverWorksSecretBox`, AES-256-GCM bound to this row's id), never in `integration_setting`, whose
 * values are plaintext. No route returns them.
 */
@MultiORMEntity('ever_works_connection', { mikroOrmRepository: () => MikroOrmEverWorksConnectionRepository })
export class EverWorksConnection extends TenantOrganizationBaseEntity {
	/** `api_key` now; `ever_id` once one-click connect through Ever ID exists. */
	@MultiORMColumn({ type: 'varchar', length: 16, default: EverWorksAuthMode.API_KEY })
	authMode!: EverWorksAuthMode;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 20, default: EverWorksConnectionStatus.ACTIVE })
	status!: EverWorksConnectionStatus;

	/** The Ever Works API base URL (`https://…/api`); `/integrations/v1` is appended per call. */
	@MultiORMColumn({ type: 'varchar', length: 2048 })
	apiBaseUrl!: string;

	/** The Ever Works tenant the key belongs to (from `whoami`); a rotated key must name the same one. */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	ewTenantId!: string;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	ewTenantSlug?: string | null;

	/** The Ever Works key id and name (from `whoami`) and the first characters of the key, for display. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	keyId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	keyName?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	keyPrefix?: string | null;

	/** The integration key, encrypted. */
	@MultiORMColumn({ type: 'text' })
	apiKeyEncrypted!: string;

	/** The key's scopes (JSON `string[]`). */
	@MultiORMColumn({ type: 'text', nullable: true })
	scopes?: string | null;

	/** The organizations the key is pinned to (JSON `[{id, slug, displayName}]`). */
	@MultiORMColumn({ type: 'text', nullable: true })
	pinnedOrganizations?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	apiVersion?: string | null;

	/** The webhook v2 subscription Ever Works delivers to, and its signing secret (encrypted). */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	webhookSubscriptionId?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	webhookSecretEncrypted?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 2048, nullable: true })
	webhookUrl?: string | null;

	/** The last change-feed `seq` read (a string: compared as a big integer). */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	feedCursor?: string | null;

	/** The last problem, as `<code>: <message>` from Ever Works or the network (never a key or a header). */
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;

	@MultiORMColumn({ nullable: true })
	lastErrorAt?: Date;

	@MultiORMColumn({ nullable: true })
	lastHealthyAt?: Date;

	@MultiORMColumn({ nullable: true })
	lastCheckedAt?: Date;

	/** The admin who connected; the `needs_reauth` notice goes to them. */
	@MultiORMColumn({ nullable: true })
	connectedByUserId?: ID;

	@MultiORMColumn({ nullable: true })
	disconnectedAt?: Date;

	/** The sync loop's database lease (one process works a connection at a time). */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	leaseOwner?: string | null;

	@MultiORMColumn({ nullable: true })
	leaseUntil?: Date;

	/** When the change feed was last read, and when a webhook last arrived (the feed's cadence). */
	@MultiORMColumn({ nullable: true })
	lastFeedPollAt?: Date;

	@MultiORMColumn({ nullable: true })
	lastWebhookAt?: Date;

	/** Set when the feed cursor expired (410): the reconcile pass resyncs every type. */
	@MultiORMColumn({ nullable: true })
	resyncRequestedAt?: Date;
}
