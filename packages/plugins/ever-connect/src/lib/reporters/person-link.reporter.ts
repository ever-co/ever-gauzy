import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Subscription } from 'rxjs';
import { EventBus } from '@gauzy/core';
import {
	EVER_ID_ACCOUNTS,
	EverIdAccountsPort,
	subjectHashOf,
	ZitadelAccountEventPayload,
	ZitadelAccountLinkedEvent,
	ZitadelAccountSignedInEvent,
	ZitadelAccountUnlinkedEvent
} from '@gauzy/plugin-auth-zitadel';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { EverConnectIdentityStore, PersonLinkReportRecord } from '../ever-connect-identity.store';
import {
	EVER_CONNECT_CLOCK,
	IDENTITY_BATCH,
	IDENTITY_RETRY_MAX_MS,
	IDENTITY_RETRY_MS
} from '../ever-connect.constants';
import { EverConnectPlatformService, errorCode, isCredentialRevoked, isUnreachable } from '../ever-connect-platform.service';
import { EverConnectSignals } from '../ever-connect-signals';
import { EverConnectStore, LinkRecord } from '../ever-connect.store';
import { EVER_ID_LOGIN, EverIdLoginHandler } from '../handlers/ever-id-login.handler';
import { ProblemError, RequestRefusedError } from '../sdk';

/** The link methods Ever Platform takes from an installation (`provisioned` is its own). */
const REPORTED_METHODS: Record<string, 'explicit' | 'confirmed' | undefined> = {
	explicit: 'explicit',
	// A sign-up with Ever ID is the person's own explicit choice.
	signup: 'explicit',
	confirmed: 'confirmed'
};

/** How many existing links one read takes when they are reported at once. */
const BACKFILL_PAGE = 200;

/** The wait before the next attempt after `attempts` failed ones (30 seconds, doubling, at most a day). */
export const retryDelay = (attempts: number): number =>
	Math.min(IDENTITY_RETRY_MS * 2 ** Math.max(0, attempts - 1), IDENTITY_RETRY_MAX_MS);

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

/**
 * Reports to Ever Platform which Gauzy users linked or unlinked an Ever ID (`POST` and
 * `DELETE /v1/instances/me/person-links`), so that a person's deletion or export request later
 * reaches exactly the installations that hold them.
 *
 * It listens to the Ever ID sign-in plugin's link events on Gauzy's event bus, and acts only while
 * this installation is connected, Sign in with Ever ID is enabled with its client ready, the identity
 * is one of Ever Platform's own issuer, and the user's tenant has a live link to an Ever
 * organization. Each link or unlink becomes a row of `ever_connect_person_link_report`; the API
 * process holding the connection's lease sends it within seconds (the same report again answers the
 * link already recorded, so no Idempotency-Key is needed). What is sent: the Gauzy user id, the issuer and subject, how the link was made,
 * the tenant and organization ids, the tenant link and the tenant's display name. Never an e-mail
 * address or a person's name.
 *
 * Ever Platform keeps a link by the Gauzy user (`DELETE` names the user), so the reports of one user
 * are sent in the order they were made: a newer one waits while an older one of the same user is
 * retried. Each report is reconciled with the Ever ID sign-in plugin's link as it is when it is sent:
 * a link that exists is reported as a link, one that does not as an unlink, whatever order the events
 * arrived in (on one API process or several). An unlink removes every link of the user on Ever
 * Platform, so the user's other Ever ID links are queued again before it is sent (once, however often
 * it is retried) and go right after it.
 *
 * Ever Platform takes a link only for a subject that signed in through this installation's own Ever ID
 * client, and answers `422 subject_unknown` otherwise. For a link just made (or one reported again
 * after an unlink) that answer, like no answer at all, is retried with a back-off of up to a day,
 * then given up (audited); for a link that existed before (the backfill) it is final at once: its
 * user never signed in through this client, and asking again changes nothing. When that user later
 * signs in with Ever ID, the link is reported again.
 *
 * Once the client is ready, the links that existed before are reported too (for the linked tenants
 * only), by the worker, until that is done.
 */
@Injectable()
export class PersonLinkReporter implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;
	private readonly subscriptions: Subscription[] = [];
	/** The link events of this process, handled one at a time in the order they were published. */
	private queue: Promise<void> = Promise.resolve();
	/** Asks the identity worker to run soon (set by the worker). */
	nudge: () => void = () => undefined;

	constructor(
		private readonly store: EverConnectStore,
		private readonly identity: EverConnectIdentityStore,
		private readonly platform: EverConnectPlatformService,
		private readonly everIdLogin: EverIdLoginHandler,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		@Optional() private readonly eventBus?: EventBus,
		@Optional() @Inject(EVER_ID_ACCOUNTS) private readonly accounts?: EverIdAccountsPort,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
	}

	onModuleInit(): void {
		if (this.eventBus) {
			this.subscriptions.push(
				this.eventBus
					.ofType(ZitadelAccountLinkedEvent)
					.subscribe((event) => this.enqueue(() => this.linked(event.payload, event.createdAt.getTime()))),
				this.eventBus
					.ofType(ZitadelAccountUnlinkedEvent)
					.subscribe((event) => this.enqueue(() => this.unlinked(event.payload, event.createdAt.getTime()))),
				this.eventBus
					.ofType(ZitadelAccountSignedInEvent)
					.subscribe((event) => this.enqueue(() => this.signedIn(event.payload)))
			);
		}
	}

	onModuleDestroy(): void {
		for (const subscription of this.subscriptions) subscription.unsubscribe();
	}

	/** Handles link events one at a time, in the order they were published in this process. */
	private enqueue(work: () => Promise<unknown>): void {
		this.queue = this.queue.then(() => this.safely(work));
	}

	/** Waits until the link events received so far are handled (for tests and shutdown). */
	settled(): Promise<void> {
		return this.queue;
	}

	/**
	 * A Gauzy user linked an Ever ID (at `at`, when the event happened): a link report, when it is to be
	 * reported and no newer report of the same identity exists (another API process may have handled a
	 * later unlink first).
	 */
	async linked(payload: ZitadelAccountEventPayload, at = this.now()): Promise<boolean> {
		const method = payload.linkMethod ? REPORTED_METHODS[payload.linkMethod] : undefined;
		if (!method || !(await this.reportable(payload))) {
			return false;
		}
		const subjectHash = subjectHashOf(payload.issuer, payload.subject);
		if (await this.newerExists(payload.userId, subjectHash, at)) {
			return false;
		}
		// An unlink of the same identity not sent yet is superseded.
		await this.supersede(payload.userId, subjectHash, 'unlink', at);
		await this.identity.addReport({
			createdAt: at,
			id: randomUUID(),
			op: 'link',
			userId: payload.userId,
			tenantId: payload.tenantId ?? null,
			tenantName: tenantDisplayName(payload.tenantName),
			issuer: payload.issuer,
			subject: payload.subject,
			subjectHash,
			linkMethod: method
		});
		this.nudge();
		return true;
	}

	/** A Gauzy user unlinked an Ever ID (at `at`): an unlink report, when it is to be reported (see {@link linked}). */
	async unlinked(payload: ZitadelAccountEventPayload, at = this.now()): Promise<boolean> {
		if (!(await this.reportable(payload))) {
			return false;
		}
		const subjectHash = subjectHashOf(payload.issuer, payload.subject);
		if (await this.newerExists(payload.userId, subjectHash, at)) {
			return false;
		}
		await this.supersede(payload.userId, subjectHash, 'link', at);
		await this.identity.addReport({
			createdAt: at,
			id: randomUUID(),
			op: 'unlink',
			userId: payload.userId,
			tenantId: payload.tenantId ?? null,
			tenantName: null,
			issuer: payload.issuer,
			subject: payload.subject,
			subjectHash,
			linkMethod: null
		});
		this.nudge();
		return true;
	}

	/**
	 * A Gauzy user signed in with Ever ID: when Ever Platform refused their link before because the
	 * subject had not signed in through this installation's client (`422 subject_unknown`), the link is
	 * reported again now (its method as stored). Nothing is queued otherwise.
	 */
	async signedIn(payload: ZitadelAccountEventPayload): Promise<boolean> {
		if (!this.accounts || !(await this.reportable(payload))) {
			return false;
		}
		const subjectHash = subjectHashOf(payload.issuer, payload.subject);
		const latest = (await this.identity.reportsOf(payload.userId, subjectHash)).filter((row) => row.state !== 'dropped').pop();
		if (latest?.state !== 'failed' || latest.lastError !== '422_subject_unknown') {
			return false;
		}
		const link = await this.accounts.findLink(payload.userId, payload.issuer, payload.subject);
		const method = link ? REPORTED_METHODS[link.linkMethod] : undefined;
		if (!link || !method) {
			return false;
		}
		await this.identity.addReport({
			id: randomUUID(),
			op: 'link',
			origin: 'event',
			userId: link.userId,
			tenantId: link.tenantId,
			tenantName: tenantDisplayName(link.tenantName),
			issuer: link.issuer,
			subject: link.subject,
			subjectHash,
			linkMethod: method
		});
		this.nudge();
		return true;
	}

	/**
	 * Reports the links that exist now, for the given tenants (default: every tenant linked to an Ever
	 * organization), read a page at a time: a link whose latest report is a link (waiting or sent) is
	 * not reported again; one whose latest report is an unlink (or that was never reported) is. Returns
	 * how many reports were added, or `null` when it could not run (not connected, no client yet, the
	 * Ever ID sign-in plugin not loaded): then nothing counts as done. Throws when the links cannot be
	 * read (the worker tries again).
	 */
	async backfill(tenants?: string[]): Promise<number | null> {
		const issuer = await this.platformIssuer();
		const linked = [...new Set((await this.store.liveLinks()).filter((l) => l.status === 'linked').map((l) => l.tenantId))];
		const tenantIds = tenants ? linked.filter((tenantId) => tenants.includes(tenantId)) : linked;
		if (!this.accounts || !issuer || !(await this.connected())) {
			return null;
		}
		if (!tenantIds.length) {
			return 0;
		}
		let added = 0;
		let after: string | null = null;
		for (;;) {
			const page = await this.accounts.links(tenantIds, after, BACKFILL_PAGE);
			for (const link of page) {
				const method = REPORTED_METHODS[link.linkMethod];
				if (!method || stripTrailingSlashes(link.issuer) !== issuer) continue;
				const subjectHash = subjectHashOf(link.issuer, link.subject);
				const latest = (await this.identity.reportsOf(link.userId, subjectHash))
					.filter((row) => row.state === 'pending' || row.state === 'sent')
					.pop();
				if (latest?.op === 'link') continue;
				// An unlink not sent yet is superseded: the link exists now.
				await this.supersede(link.userId, subjectHash, 'unlink');
				await this.identity.addReport({
					id: randomUUID(),
					op: 'link',
					origin: 'backfill',
					userId: link.userId,
					tenantId: link.tenantId,
					tenantName: tenantDisplayName(link.tenantName),
					issuer: link.issuer,
					subject: link.subject,
					subjectHash,
					linkMethod: method
				});
				added++;
			}
			if (page.length < BACKFILL_PAGE) break;
			after = page[page.length - 1].id;
		}
		if (added) {
			await this.audit.record({
				action: 'person_link.report',
				actorLabel: 'system',
				integration: EVER_ID_LOGIN,
				details: { op: 'link', state: 'pending', count: added }
			});
			this.nudge();
		}
		return added;
	}

	/** Sign in with Ever ID was switched off: nothing more is reported. */
	async stop(): Promise<void> {
		await this.identity.dropPendingReports();
	}

	/** Sends the reports that are due (by the API process holding the connection's lease). */
	async sendDue(): Promise<number> {
		const due = await this.identity.dueReports(this.now(), IDENTITY_BATCH);
		if (!due.length) {
			return 0;
		}
		let sent = 0;
		for (const candidate of due) {
			// Read again: a person's deletion may have removed it, switching off or a newer report dropped
			// it, or the integration ended, while the reports before it were sent.
			const row = await this.identity.report(candidate.id);
			if (!row || row.state !== 'pending') continue;
			if ((await this.store.integration('instance', EVER_ID_LOGIN))?.enabled !== true) {
				await this.identity.updateReport(row.id, { state: 'dropped', nextAttemptAt: null, lastError: 'integration_off' });
				continue;
			}
			// One user's reports go in order: this one waits while an earlier one of the same user is pending.
			if (await this.identity.hasEarlierPending(row)) continue;
			if (await this.send(row)) sent++;
		}
		return sent;
	}

	/** Sends one report, as the link is now; returns whether Ever Platform took it. */
	private async send(queued: PersonLinkReportRecord): Promise<boolean> {
		let row = queued;
		try {
			// The link as it is now decides what is sent (an event of another process may have come later).
			const current = this.accounts ? await this.accounts.findLink(row.userId, row.issuer, row.subject) : undefined;
			if (current !== undefined) {
				const op = current ? 'link' : 'unlink';
				const linkMethod = current ? (REPORTED_METHODS[current.linkMethod] ?? null) : row.linkMethod;
				if (op === 'link' && !linkMethod) {
					await this.identity.updateReport(row.id, { state: 'dropped', nextAttemptAt: null, lastError: 'not_reported_method' });
					return false;
				}
				if (op !== row.op || linkMethod !== row.linkMethod) {
					const tenantName = current ? tenantDisplayName(current.tenantName) : row.tenantName;
					await this.identity.updateReport(row.id, { op, linkMethod, tenantName });
					row = { ...row, op, linkMethod, tenantName };
				}
			}
			const client = await this.platform.getClient();
			if (row.op === 'link') {
				const link = row.tenantId ? await this.tenantLink(row.tenantId) : null;
				if (!link) {
					await this.identity.updateReport(row.id, { state: 'dropped', nextAttemptAt: null, lastError: 'not_linked' });
					return false;
				}
				await client.instances.personLinks.create(
					{
						product_user_ref: row.userId,
						identity_issuer: row.issuer,
						identity_subject: row.subject,
						link_method: row.linkMethod as 'explicit' | 'confirmed',
						product_tenant_id: link.tenantId,
						product_org_id: link.organizationId,
						tenant_link_id: link.linkId,
						...(row.tenantName ? { display_name: row.tenantName } : {})
					}
				);
			} else {
				// Queued first: if the unlink goes through and anything after it fails, they are kept.
				await this.reportOtherLinks(row);
				await client.instances.personLinks.remove(row.userId);
			}
			await this.identity.updateReport(row.id, {
				state: 'sent',
				sentAt: this.now(),
				nextAttemptAt: null,
				attempts: row.attempts + 1,
				lastError: null
			});
			await this.audit.record({
				action: 'person_link.report',
				actorLabel: 'system',
				tenantId: row.tenantId,
				integration: EVER_ID_LOGIN,
				details: { op: row.op, state: 'sent' }
			});
			return true;
		} catch (error) {
			await this.failed(row, error);
			return false;
		}
	}

	/** A report that did not go through: retried, given up, or dropped, by what Ever Platform answered. */
	private async failed(row: PersonLinkReportRecord, error: unknown): Promise<void> {
		if (isCredentialRevoked(error)) {
			this.signals.revoked$.next();
			return;
		}
		const code = errorCode(error).replace(/\s+/g, '_').slice(0, 64);
		const attempts = row.attempts + 1;
		if (error instanceof ProblemError && error.status === 403) {
			// Sign in with Ever ID is not enabled on Ever Platform (any more): nothing to report.
			await this.identity.updateReport(row.id, { state: 'dropped', nextAttemptAt: null, attempts, lastError: code });
			return;
		}
		const subjectUnknown = error instanceof ProblemError && error.status === 422 && error.code === 'subject_unknown';
		const retryable =
			isUnreachable(error) ||
			// A link that existed before: its user never signed in through this installation's client (final).
			(subjectUnknown && row.origin !== 'backfill') ||
			!(error instanceof ProblemError || error instanceof RequestRefusedError);
		// Retried until the wait before this attempt was already a day.
		if (retryable && retryDelay(row.attempts) < IDENTITY_RETRY_MAX_MS) {
			await this.identity.updateReport(row.id, { nextAttemptAt: this.now() + retryDelay(attempts), attempts, lastError: code });
			return;
		}
		await this.identity.updateReport(row.id, { state: 'failed', nextAttemptAt: null, attempts, lastError: code });
		await this.audit.record({
			action: 'person_link.report',
			actorLabel: 'system',
			tenantId: row.tenantId,
			integration: EVER_ID_LOGIN,
			details: { op: row.op, state: 'failed', reason: code, attempts }
		});
		this.logger.warn(`An Ever ID ${row.op} could not be reported to Ever Platform (${code}); it is given up.`);
	}

	/**
	 * Before an unlink: Ever Platform removes every link of the user (it keys them by the user), so the
	 * user's other links of Ever Platform's issuer are queued again (not when a link report of the same
	 * identity already waits); they go after the unlink, which is older.
	 */
	private async reportOtherLinks(row: PersonLinkReportRecord): Promise<void> {
		const issuer = await this.platformIssuer();
		if (!this.accounts || !issuer) {
			return;
		}
		for (const link of await this.accounts.linksOfUser(row.userId)) {
			const method = REPORTED_METHODS[link.linkMethod];
			if (!method || stripTrailingSlashes(link.issuer) !== issuer || link.subject === row.subject) continue;
			const subjectHash = subjectHashOf(link.issuer, link.subject);
			const waiting = (await this.identity.reportsOf(link.userId, subjectHash)).some(
				(other) => other.op === 'link' && other.state === 'pending'
			);
			if (waiting) continue;
			await this.identity.addReport({
				id: randomUUID(),
				op: 'link',
				origin: 'repair',
				userId: link.userId,
				tenantId: link.tenantId,
				tenantName: tenantDisplayName(link.tenantName),
				issuer: link.issuer,
				subject: link.subject,
				subjectHash,
				linkMethod: method
			});
			this.nudge();
		}
	}

	/** Whether a link event is to be reported (see the class). */
	private async reportable(payload: ZitadelAccountEventPayload): Promise<boolean> {
		if (!payload?.userId || !payload.issuer || !payload.subject || !payload.tenantId) {
			return false;
		}
		const issuer = await this.platformIssuer();
		if (!issuer || stripTrailingSlashes(payload.issuer) !== issuer || !(await this.connected())) {
			return false;
		}
		return (await this.tenantLink(payload.tenantId)) !== null;
	}

	/** Ever Platform's issuer, once Sign in with Ever ID is enabled and its client ready. */
	private async platformIssuer(): Promise<string | null> {
		const config = (await this.everIdLogin.isEverIdLoginEnabled()) ? await this.everIdLogin.getEverIdLoginConfig() : null;
		return config ? stripTrailingSlashes(config.issuer) : null;
	}

	private async connected(): Promise<boolean> {
		const connection = await this.store.connection();
		return connection.status === 'connected' && !!connection.platformInstanceId;
	}

	/** The tenant's oldest live link to an Ever organization, or `null`. */
	private async tenantLink(tenantId: string): Promise<LinkRecord | null> {
		const links = (await this.store.liveLinks())
			.filter((link) => link.tenantId === tenantId && link.status === 'linked')
			.sort((a, b) => a.createdAt - b.createdAt);
		return links[0] ?? null;
	}

	/** Whether a report of the same user and identity happened after `at` (this event is older than what is known). */
	private async newerExists(userId: string, subjectHash: string, at: number): Promise<boolean> {
		return (await this.identity.reportsOf(userId, subjectHash)).some((row) => row.createdAt > at && row.state !== 'dropped');
	}

	/** Older pending reports of the opposite operation for the same user and identity are not sent any more. */
	private async supersede(userId: string, subjectHash: string, op: 'link' | 'unlink', at = this.now()): Promise<void> {
		for (const row of await this.identity.reportsOf(userId, subjectHash)) {
			if (row.op === op && row.state === 'pending' && row.createdAt <= at) {
				await this.identity.updateReport(row.id, { state: 'dropped', nextAttemptAt: null, lastError: 'superseded' });
			}
		}
	}

	private async safely(work: () => Promise<unknown>): Promise<void> {
		try {
			await work();
		} catch (error) {
			this.logger.warn(`An Ever ID link could not be queued for Ever Platform (${errorCode(error)}).`);
		}
	}
}

/** The tenant's display name as reported: at most 120 characters, never one that looks like an e-mail address. */
export function tenantDisplayName(name: string | null | undefined): string | null {
	const value = (name ?? '').trim().slice(0, 120);
	return value && !value.includes('@') ? value : null;
}
