import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ActorLabel, EverConnectAuditService } from './ever-connect-audit.service';
import { EVER_CONNECT_CLOCK, EVER_CONNECT_ENV, ENTITLEMENT_REFRESHES_PER_HOUR } from './ever-connect.constants';
import { EverConnectPlatformService, isCredentialRevoked } from './ever-connect-platform.service';
import { EverConnectSecretStore } from './ever-connect-secret-store';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore, LinkRecord } from './ever-connect.store';
import {
	EntitlementError,
	entitlementStatus,
	EntitlementStatus,
	claimsOfVerifiedJws,
	RateLimitedError,
	VerifiedEntitlement
} from './sdk';

/** What the Entitlements tab shows of one stored document (decoded; never the document itself). */
export interface EntitlementSummary {
	subject: 'instance' | 'link';
	status: EntitlementStatus;
	seq: number | null;
	issued_at: string | null;
	expires_at: string | null;
	fetched_at: string | null;
	handle: string | null;
	tier: string | null;
	plan: string | null;
	features: Record<string, boolean>;
	limits: Record<string, number>;
	meters: Record<string, { used: number; period: string | null }>;
}

/** A link's document names another Gauzy tenant or organization than the one the link belongs to here. */
export class LinkBindingError extends Error {
	readonly code = 'tenant_mismatch';
	constructor() {
		super('The link document names another tenant or organization.');
		this.name = 'LinkBindingError';
	}
}

/**
 * Throws {@link LinkBindingError} unless the verified link document is bound to `owner` (its
 * `ever.tenant` names this Gauzy tenant and organization, when it names one).
 */
export function checkLinkBinding(
	verified: VerifiedEntitlement,
	owner: { tenantId: string; organizationId: string }
): void {
	const tenant = (verified.claims.ever as { tenant?: { product_tenant_id?: string; product_org_id?: string } | null })
		.tenant;
	if (tenant && (tenant.product_tenant_id !== owner.tenantId || tenant.product_org_id !== owner.organizationId)) {
		throw new LinkBindingError();
	}
}

const iso = (seconds: number | null | undefined) =>
	typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
const isoMs = (ms: number | null | undefined) => (typeof ms === 'number' ? new Date(ms).toISOString() : null);

/**
 * Entitlement documents: fetched from Ever Platform, verified with the SDK's verifier before
 * anything is stored (issuer, key, signature, schema, this installation, the expected subject, never
 * older than the stored one), then stored encrypted as the bytes received.
 */
@Injectable()
export class EverConnectEntitlementService {
	private readonly secrets: EverConnectSecretStore;
	private readonly now: () => number;
	/** On-demand refreshes of the last hour, per document (`instance`, or a link id). */
	private readonly refreshes = new Map<string, number[]>();

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.secrets = new EverConnectSecretStore(env ?? process.env);
		this.now = clock?.now ?? (() => Date.now());
	}

	/** Fetches and verifies the installation's document; nothing is stored here. Throws when it does not verify. */
	async fetchInstanceDocument(registryId: string): Promise<VerifiedEntitlement> {
		const client = await this.platform.getClient();
		const answer = await client.instances.entitlement();
		if ('notModified' in answer) {
			throw new EntitlementError('malformed');
		}
		return this.platform.verify(answer.document, `instance:${registryId}`);
	}

	/** Fetches and verifies a link's document; nothing is stored here. Throws when it does not verify. */
	async fetchLinkDocument(linkId: string): Promise<VerifiedEntitlement> {
		const client = await this.platform.getClient();
		const answer = await client.instances.linkEntitlement(linkId);
		if ('notModified' in answer) {
			throw new EntitlementError('malformed');
		}
		return this.platform.verify(answer.document, `link:${linkId}`);
	}

	/** Stores the installation's verified document (encrypted). */
	async storeInstanceDocument(verified: VerifiedEntitlement): Promise<void> {
		await this.store.updateConnection({
			instanceEntitlementJwsEncrypted: this.secrets.seal(verified.jws),
			instanceEntitlementSeq: verified.seq,
			instanceEntitlementIat: verified.claims.iat,
			instanceEntitlementExp: verified.claims.exp,
			instanceEntitlementFetchedAt: this.now(),
			ownerOrgId: verified.claims.ever.org_id,
			ownerHandle: verified.claims.ever.handle
		});
	}

	/** The columns of a link row that hold its verified document. */
	linkDocumentColumns(verified: VerifiedEntitlement): Partial<LinkRecord> {
		return {
			entitlementJwsEncrypted: this.secrets.seal(verified.jws),
			entitlementSeq: verified.seq,
			entitlementIat: verified.claims.iat,
			entitlementExp: verified.claims.exp,
			entitlementFetchedAt: this.now(),
			everHandle: verified.claims.ever.handle
		};
	}

	/**
	 * On-demand refresh (the Entitlements tab), at most 6 an hour for each document, else 429: the
	 * caller's organization link's document, and the installation's for the operator only (other
	 * tenants never spend the installation's budget, nor each other's).
	 */
	async refreshOnDemand(actor: {
		userId: string | null;
		tenantId: string;
		organizationId: string;
		isOperator: boolean;
	}): Promise<void> {
		const link = await this.store.linkOf(actor.tenantId, actor.organizationId);
		const documents = [...(actor.isOperator ? ['instance'] : []), ...(link ? [link.linkId] : [])];
		if (!documents.length) {
			return;
		}
		const hourAgo = this.now() - 3_600_000;
		for (const document of documents) {
			const recent = (this.refreshes.get(document) ?? []).filter((at) => at > hourAgo);
			this.refreshes.set(document, recent);
			if (recent.length >= ENTITLEMENT_REFRESHES_PER_HOUR) {
				throw new HttpException(
					{ statusCode: 429, code: 'rate_limited', message: 'At most 6 refreshes an hour.' },
					HttpStatus.TOO_MANY_REQUESTS
				);
			}
		}
		for (const document of documents) {
			this.refreshes.get(document)?.push(this.now());
		}
		if (actor.isOperator) {
			await this.refreshInstance({ actorLabel: 'operator', actorUserId: actor.userId });
		}
		if (link) {
			await this.refreshLink(link, { actorLabel: 'user', actorUserId: actor.userId });
		}
	}

	/**
	 * Refreshes the installation's document (`If-None-Match` on the stored sequence: 304 changes
	 * nothing). A document older than the stored one is refused (`entitlement_stale`, audited); the
	 * stored one stays.
	 */
	async refreshInstance(
		actor: { actorLabel: ActorLabel; actorUserId?: string | null } = { actorLabel: 'system' }
	): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId) {
			return;
		}
		// The stored sequence and issue time (kept in clear) guard against an older document, also when
		// the stored document itself cannot be read any more.
		const cached =
			connection.instanceEntitlementSeq !== null
				? { seq: connection.instanceEntitlementSeq, iat: connection.instanceEntitlementIat ?? 0 }
				: null;
		await this.guard(async () => {
			const client = await this.platform.getClient();
			const answer = await client.instances.entitlement(cached?.seq);
			if ('notModified' in answer) {
				await this.store.updateConnection({ instanceEntitlementFetchedAt: this.now() });
				return;
			}
			try {
				const verified = await this.platform.verify(
					answer.document,
					`instance:${connection.platformInstanceId}`,
					cached
				);
				await this.storeInstanceDocument(verified);
				await this.audit.record({
					action: 'entitlement.refresh',
					actorLabel: actor.actorLabel,
					actorUserId: actor.actorUserId,
					details: { subject: 'instance', seq: verified.seq, status: 'stored' }
				});
			} catch (error) {
				await this.refused(error, 'instance', actor);
			}
		});
	}

	/** Refreshes one link's document, as {@link refreshInstance} does. */
	async refreshLink(
		link: LinkRecord,
		actor: { actorLabel: ActorLabel; actorUserId?: string | null } = { actorLabel: 'system' }
	): Promise<void> {
		if (link.status === 'unlinked') {
			return;
		}
		const cached =
			link.entitlementSeq !== null ? { seq: link.entitlementSeq, iat: link.entitlementIat ?? 0 } : null;
		await this.guard(async () => {
			const client = await this.platform.getClient();
			const answer = await client.instances.linkEntitlement(link.linkId, cached?.seq);
			if ('notModified' in answer) {
				await this.store.updateLink(link.linkId, { entitlementFetchedAt: this.now() });
				return;
			}
			try {
				const verified = await this.platform.verify(answer.document, `link:${link.linkId}`, cached);
				checkLinkBinding(verified, link);
				await this.store.updateLink(link.linkId, this.linkDocumentColumns(verified));
				if (
					link.integrationTenantId &&
					verified.claims.ever.handle &&
					verified.claims.ever.handle !== link.everHandle
				) {
					await this.store.updateLinkRecordSettings(link.integrationTenantId, {
						EVER_HANDLE: verified.claims.ever.handle
					});
				}
				await this.audit.record({
					action: 'entitlement.refresh',
					actorLabel: actor.actorLabel,
					actorUserId: actor.actorUserId,
					tenantId: link.tenantId,
					organizationId: link.organizationId,
					details: { subject: 'link', link_id: link.linkId, seq: verified.seq, status: 'stored' }
				});
			} catch (error) {
				await this.refused(error, 'link', actor, link);
			}
		});
	}

	/** Every document: the installation's and each live link's. */
	async refreshAll(): Promise<void> {
		await this.refreshInstance();
		for (const link of await this.store.liveLinks()) {
			await this.refreshLink(link);
		}
	}

	/** The decoded summary of the stored documents for one organization (and the installation). */
	async summary(
		tenantId: string,
		organizationId: string,
		isOperator: boolean
	): Promise<{ instance: EntitlementSummary | null; link: EntitlementSummary | null }> {
		const connection = await this.store.connection();
		const link = await this.store.linkOf(tenantId, organizationId);
		return {
			instance: isOperator
				? this.summarize(
						'instance',
						this.secrets.open(connection.instanceEntitlementJwsEncrypted),
						connection.instanceEntitlementFetchedAt
					)
				: null,
			link: link
				? this.summarize('link', this.secrets.open(link.entitlementJwsEncrypted), link.entitlementFetchedAt)
				: null
		};
	}

	private summarize(
		subject: 'instance' | 'link',
		jws: string | null,
		fetchedAt: number | null
	): EntitlementSummary | null {
		// Stored documents were verified before they were stored: their claims are read for display only.
		const payload = jws ? claimsOfVerifiedJws(jws) : null;
		if (!payload) {
			return null;
		}
		const claims = payload as { iat?: number; exp?: number; ever?: Record<string, unknown> };
		const ever = (claims.ever ?? {}) as Record<string, unknown> & { plan?: { code?: unknown } };
		return {
			subject,
			status: entitlementStatus(claims as never, Math.floor(this.now() / 1000)),
			seq: typeof ever['seq'] === 'number' ? ever['seq'] : null,
			issued_at: iso(claims.iat),
			expires_at: iso(claims.exp),
			fetched_at: isoMs(fetchedAt),
			handle: typeof ever['handle'] === 'string' ? ever['handle'] : null,
			tier: typeof ever['tier'] === 'string' ? ever['tier'] : null,
			plan: typeof ever.plan?.code === 'string' ? ever.plan.code : null,
			features: { ...((ever['features'] as Record<string, boolean>) ?? {}) },
			limits: { ...((ever['limits'] as Record<string, number>) ?? {}) },
			meters: { ...((ever['meters'] as Record<string, { used: number; period: string | null }>) ?? {}) }
		};
	}

	private async refused(
		error: unknown,
		subject: 'instance' | 'link',
		actor: { actorLabel: ActorLabel; actorUserId?: string | null },
		link?: LinkRecord
	): Promise<void> {
		if (!(error instanceof EntitlementError) && !(error instanceof LinkBindingError)) {
			throw error;
		}
		await this.store.updateConnection({ lastError: `entitlement_${error.code}` });
		await this.audit.record({
			action: 'entitlement.refresh',
			actorLabel: actor.actorLabel,
			actorUserId: actor.actorUserId,
			tenantId: link?.tenantId ?? null,
			organizationId: link?.organizationId ?? null,
			details: {
				subject,
				status: error.code === 'entitlement_stale' ? 'stale' : 'refused',
				reason: error.code,
				...(link ? { link_id: link.linkId } : {})
			}
		});
	}

	/**
	 * Runs one refresh. A read the SDK holds back (Ever Platform allows 6 reads an hour per document)
	 * is skipped: the stored document stays and the next refresh reads it.
	 */
	private async guard(work: () => Promise<void>): Promise<void> {
		try {
			await work();
		} catch (error) {
			if (error instanceof RateLimitedError) {
				return;
			}
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
			}
			throw error;
		}
	}
}
