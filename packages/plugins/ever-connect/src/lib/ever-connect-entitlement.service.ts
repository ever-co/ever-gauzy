import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { HttpException, HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
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

/**
 * Where a document stands on the grace ladder: `valid` until it expires, `grace` for `grace_s` after
 * that (30 days unless the document says otherwise; its features still apply), then `paused` (no
 * document, a revoked connection, or the grace over): Ever Platform features pause, nothing else.
 */
export type EntitlementLadder = 'valid' | 'grace' | 'paused';

/** The ladder of a verified document's claims at `nowS` (seconds); `revoked` pauses whatever the dates say. */
export function entitlementLadder(
	claims: { exp: number; ever: { grace_s?: number } } | null | undefined,
	nowS: number,
	revoked = false
): EntitlementLadder {
	if (revoked || !claims) {
		return 'paused';
	}
	const status = entitlementStatus(claims as never, nowS);
	return status === 'valid' ? 'valid' : status === 'stale' ? 'grace' : 'paused';
}

/** The largest entitlement document accepted from a file (the operator's upload or EVER_ENTITLEMENT_FILE). */
export const ENTITLEMENT_FILE_MAX_BYTES = 16 * 1024;

/** What an imported document was: its subject, its sequence, and whether it replaced the stored one. */
export interface EntitlementImportResult {
	subject: 'instance' | 'link';
	seq: number;
	status: 'stored' | 'unchanged';
}

/** What the Entitlements tab shows of one stored document (decoded; never the document itself). */
export interface EntitlementSummary {
	subject: 'instance' | 'link';
	status: EntitlementStatus;
	ladder: EntitlementLadder;
	/** The licence certificate ids the document names (`EVER-GAUZY-SB-1A2B3C4D`): shown, never checked. */
	licence_ids: string[];
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
	private readonly logger = new Logger('EverConnect');
	private readonly env: Record<string, string | undefined>;
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
		this.env = env ?? process.env;
		this.secrets = new EverConnectSecretStore(this.env);
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

	/**
	 * The Ever Platform features one organization may use now, from its link's stored document only
	 * (no request is made): the document's `features` while it is valid or in grace, every feature off
	 * when it is paused (no document, the grace over, the connection not connected). Nothing outside the
	 * Ever Platform module reads this: the product's own features never depend on it.
	 */
	async features(
		tenantId: string,
		organizationId: string
	): Promise<{ ladder: EntitlementLadder; features: Record<string, boolean> }> {
		const connection = await this.store.connection();
		const link = await this.store.linkOf(tenantId, organizationId);
		const jws = link && connection.status === 'connected' ? this.secrets.open(link.entitlementJwsEncrypted) : null;
		const claims = jws
			? (claimsOfVerifiedJws(jws) as {
					exp: number;
					ever: { grace_s?: number; features?: Record<string, boolean> };
				} | null)
			: null;
		const ladder = entitlementLadder(claims, Math.floor(this.now() / 1000));
		const features: Record<string, boolean> = { ...(claims?.ever?.features ?? {}) };
		if (ladder === 'paused') {
			for (const key of Object.keys(features)) features[key] = false;
		}
		return { ladder, features };
	}

	/**
	 * Imports a downloaded entitlement document (for an installation without a route to Ever
	 * Platform): the same checks as a refresh (issuer, key, signature, schema, this installation, a
	 * subject of this installation, never older than the stored one), then stored as a refresh stores
	 * it. Throws an `HttpException`: 409 `not_connected`, 413 `too_large`, 422 `entitlement_invalid`.
	 */
	async importDocument(
		jws: unknown,
		actor: { actorLabel: ActorLabel; actorUserId?: string | null }
	): Promise<EntitlementImportResult> {
		const invalid = (reason: string) =>
			new HttpException(
				{
					statusCode: 422,
					code: 'entitlement_invalid',
					reason,
					message: 'The entitlement document was refused.'
				},
				HttpStatus.UNPROCESSABLE_ENTITY
			);
		if (typeof jws !== 'string' || jws.trim() === '') {
			throw invalid('malformed');
		}
		const document = jws.trim();
		if (Buffer.byteLength(document, 'utf8') > ENTITLEMENT_FILE_MAX_BYTES) {
			throw new HttpException(
				{ statusCode: 413, code: 'too_large', message: 'An entitlement document is at most 16 KiB.' },
				HttpStatus.PAYLOAD_TOO_LARGE
			);
		}
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId) {
			throw new HttpException(
				{
					statusCode: 409,
					code: 'not_connected',
					message: 'Connect this installation to Ever Platform first.'
				},
				HttpStatus.CONFLICT
			);
		}
		// The subject only routes the document; the verifier then requires exactly that subject.
		let sub: unknown = null;
		try {
			sub = (claimsOfVerifiedJws(document) as { sub?: unknown } | null)?.sub ?? null;
		} catch {
			sub = null;
		}
		let link: LinkRecord | null = null;
		if (typeof sub === 'string' && sub.startsWith('link:')) {
			link = await this.store.linkById(sub.slice('link:'.length));
			if (!link || link.status === 'unlinked') {
				await this.importRefused('subject_mismatch', actor);
				throw invalid('subject_mismatch');
			}
		} else if (sub !== `instance:${connection.platformInstanceId}`) {
			const reason = typeof sub === 'string' ? 'subject_mismatch' : 'malformed';
			await this.importRefused(reason, actor);
			throw invalid(reason);
		}
		const subject = link ? 'link' : 'instance';
		const storedSeq = link ? link.entitlementSeq : connection.instanceEntitlementSeq;
		const storedIat = (link ? link.entitlementIat : connection.instanceEntitlementIat) ?? 0;
		let verified: VerifiedEntitlement;
		try {
			// No cached floor here: the same document again (a restart with the same file) is answered
			// `unchanged` below, an older one `entitlement_stale`.
			verified = await this.platform.verify(
				document,
				link ? `link:${link.linkId}` : `instance:${connection.platformInstanceId}`
			);
			if (link) checkLinkBinding(verified, link);
		} catch (error) {
			if (error instanceof EntitlementError || error instanceof LinkBindingError) {
				await this.importRefused(error.code, actor, link);
				throw invalid(error.code);
			}
			throw error;
		}
		if (storedSeq !== null && verified.seq === storedSeq && verified.claims.iat === storedIat) {
			return { subject, seq: verified.seq, status: 'unchanged' };
		}
		if (storedSeq !== null && (verified.seq <= storedSeq || verified.claims.iat < storedIat)) {
			await this.importRefused('entitlement_stale', actor, link);
			throw invalid('entitlement_stale');
		}
		if (link) {
			await this.store.updateLink(link.linkId, this.linkDocumentColumns(verified));
		} else {
			await this.storeInstanceDocument(verified);
		}
		await this.audit.record({
			action: 'entitlement.refresh',
			actorLabel: actor.actorLabel,
			actorUserId: actor.actorUserId,
			tenantId: link?.tenantId ?? null,
			organizationId: link?.organizationId ?? null,
			details: {
				subject,
				...(link ? { link_id: link.linkId } : {}),
				seq: verified.seq,
				status: 'stored',
				source: 'file'
			}
		});
		return { subject, seq: verified.seq, status: 'stored' };
	}

	/**
	 * `EVER_ENTITLEMENT_FILE`: a downloaded document imported once the connection starts. A file that
	 * cannot be read or is refused logs a short reason and changes nothing; the same document again
	 * (a restart) changes nothing either.
	 */
	async importFromEnvFile(): Promise<EntitlementImportResult | null> {
		const path = (this.env['EVER_ENTITLEMENT_FILE'] ?? '').trim();
		if (!path) {
			return null;
		}
		let document: string;
		try {
			const bytes = await readFile(path);
			if (bytes.length > ENTITLEMENT_FILE_MAX_BYTES) {
				this.logger.warn('EVER_ENTITLEMENT_FILE is larger than 16 KiB; it is not imported.');
				return null;
			}
			document = bytes.toString('utf8');
		} catch {
			this.logger.warn('EVER_ENTITLEMENT_FILE could not be read; it is not imported.');
			return null;
		}
		const digest = createHash('sha256').update(document.trim()).digest('hex').slice(0, 12);
		try {
			const result = await this.importDocument(document, { actorLabel: 'system' });
			if (result.status === 'stored') {
				this.logger.log(
					`EVER_ENTITLEMENT_FILE imported (${result.subject} document #${result.seq}, ${digest}).`
				);
			}
			return result;
		} catch (error) {
			const answer =
				error instanceof HttpException ? (error.getResponse() as { reason?: string; code?: string }) : {};
			this.logger.warn(
				`EVER_ENTITLEMENT_FILE was not imported (${answer.reason ?? answer.code ?? 'error'}, ${digest}).`
			);
			return null;
		}
	}

	private async importRefused(
		reason: string,
		actor: { actorLabel: ActorLabel; actorUserId?: string | null },
		link?: LinkRecord | null
	): Promise<void> {
		await this.audit.record({
			action: 'entitlement.refresh',
			actorLabel: actor.actorLabel,
			actorUserId: actor.actorUserId,
			tenantId: link?.tenantId ?? null,
			organizationId: link?.organizationId ?? null,
			details: {
				subject: link ? 'link' : 'instance',
				...(link ? { link_id: link.linkId } : {}),
				status: reason === 'entitlement_stale' ? 'stale' : 'refused',
				reason,
				source: 'file'
			}
		});
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
						connection.instanceEntitlementFetchedAt,
						connection.status === 'revoked'
					)
				: null,
			link: link
				? this.summarize(
						'link',
						this.secrets.open(link.entitlementJwsEncrypted),
						link.entitlementFetchedAt,
						connection.status === 'revoked'
					)
				: null
		};
	}

	private summarize(
		subject: 'instance' | 'link',
		jws: string | null,
		fetchedAt: number | null,
		revoked = false
	): EntitlementSummary | null {
		// Stored documents were verified before they were stored: their claims are read for display only.
		const payload = jws ? claimsOfVerifiedJws(jws) : null;
		if (!payload) {
			return null;
		}
		const claims = payload as { iat?: number; exp?: number; ever?: Record<string, unknown> };
		const ever = (claims.ever ?? {}) as Record<string, unknown> & { plan?: { code?: unknown } };
		const nowS = Math.floor(this.now() / 1000);
		const licenceIds = Array.isArray(ever['licence_ids'])
			? (ever['licence_ids'] as unknown[]).filter((id): id is string => typeof id === 'string')
			: [];
		return {
			subject,
			status: entitlementStatus(claims as never, nowS),
			ladder: entitlementLadder(claims as never, nowS, revoked),
			licence_ids: licenceIds,
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
