import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, MoreThan, MoreThanOrEqual, Not } from 'typeorm';
import { ID, IInboxDeliveryStatus, InboxDeliveryChannelEnum } from '@gauzy/contracts';
import { EmailSendService, RequestContext } from '@gauzy/core';
import { INBOX_DELIVERY_DIGEST_MAX_ITEMS } from './inbox-delivery.constants';
import { InboxDelivery } from './inbox-delivery.entity';
import { isInboxNotificationEmailEnabled, isInboxWebPushEnabled } from '../inbox-enabled';
import { readInboxWebPushConfig } from './push/inbox-push.constants';

/** How long a transport that answered is trusted before it is checked again. */
export const INBOX_DELIVERY_STATUS_AVAILABLE_TTL_MS = 10 * 60_000;
/** How long a missing (or failing) transport is remembered: short, so a fixed configuration shows soon. */
export const INBOX_DELIVERY_STATUS_UNAVAILABLE_TTL_MS = 2 * 60_000;
/** The longest a check may take; a transport that has not answered by then counts as unavailable. */
export const INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS = 10_000;
/** The most scopes remembered at once; the oldest is dropped first. */
export const INBOX_DELIVERY_STATUS_MAX_ENTRIES = 1_000;
/** How far back the delivery log is read for recent sends. */
export const INBOX_DELIVERY_STATUS_HISTORY_MS = 24 * 60 * 60_000;
/**
 * Failed send attempts in a row (newest first, none sent in between) that make email unavailable: one failure is often
 * one recipient refused; several in a row with nothing sent since is the transport.
 */
export const INBOX_DELIVERY_STATUS_FAILURES_IN_A_ROW = 3;
/**
 * The attempted rows of the scope that are read (newest first): enough for {@link INBOX_DELIVERY_STATUS_FAILURES_IN_A_ROW}
 * failed digests of the largest size, each recorded on every entry it carried, so a large digest cannot hide the
 * failures before it.
 */
export const INBOX_DELIVERY_STATUS_HISTORY_ROWS = INBOX_DELIVERY_DIGEST_MAX_ITEMS * INBOX_DELIVERY_STATUS_FAILURES_IN_A_ROW + 1;

interface ITransportCheck {
	available: boolean;
	checkedAt: Date;
	expiresAt: number;
}

/**
 * Whether the Inbox can deliver through email and web push for the caller's tenant and organization.
 *
 * Email needs the flag, a transport and sends that go through:
 *
 * - the platform's resolution (a provider account, the organization's SMTP, the tenant's, then the server's `MAIL_*`)
 *   must answer; the SMTP chain verifies its connection there, a provider account does not (an API-key transport is
 *   only refused when it sends);
 * - so the delivery log is read as well: when the scope's latest email attempts (the last day) are
 *   {@link INBOX_DELIVERY_STATUS_FAILURES_IN_A_ROW} or more failed sends (an email, not a row: a digest is one email
 *   recorded on each of its entries) with none sent since, email is unavailable
 *   whatever the transport answered — a revoked key or a refused sender shows here. A delivery that was skipped
 *   without an attempt (a person without an address) is not a failed send.
 *
 * The answer is cached per tenant and organization, one check runs at a time per scope, and a check that hangs counts
 * as unavailable after {@link INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS} (the lookup and the log read together). Nothing
 * about the transport (host, account,
 * error) is returned.
 */
@Injectable()
export class InboxDeliveryStatusService {
	private readonly logger = new Logger(InboxDeliveryStatusService.name);
	private readonly checks = new Map<string, ITransportCheck>();
	private readonly pending = new Map<string, Promise<ITransportCheck>>();
	/**
	 * The checks still running per scope, including one whose time ran out: a stalled lookup or log read is not
	 * started again while it runs, so stalls cannot pile up and hold database connections.
	 */
	private readonly inflight = new Map<string, Promise<boolean>>();

	/** The clock (a spec replaces it). */
	protected now: () => number = () => Date.now();

	constructor(@Inject(EmailSendService) private readonly sender: EmailSendService, private readonly dataSource: DataSource) {}

	/** The status for the caller's tenant and the organization of the request. */
	async status(): Promise<IInboxDeliveryStatus> {
		const tenantId = RequestContext.currentTenantId() as ID | null;
		const organizationId = RequestContext.currentOrganizationId() as ID | null;
		const emailEnabled = isInboxNotificationEmailEnabled();
		const pushEnabled = isInboxWebPushEnabled();
		const transport = emailEnabled && tenantId ? await this.transport(tenantId, organizationId) : null;
		return {
			email: { enabled: emailEnabled, available: !!transport?.available },
			push: { enabled: pushEnabled, available: pushEnabled && !!readInboxWebPushConfig() },
			checkedAt: (transport?.checkedAt ?? new Date(this.now())).toISOString()
		};
	}

	/** The cached check of a scope, or a new one (shared by the requests that arrive while it runs). */
	private async transport(tenantId: ID, organizationId: ID | null): Promise<ITransportCheck> {
		const key = `${tenantId}:${organizationId ?? ''}`;
		const cached = this.checks.get(key);
		if (cached && cached.expiresAt > this.now()) return cached;
		const running = this.pending.get(key);
		if (running) return running;
		if (this.inflight.has(key)) {
			// The last check of this scope is still stuck: unavailable, without starting another.
			const checkedAt = new Date(this.now());
			const stuck = { available: false, checkedAt, expiresAt: checkedAt.getTime() + INBOX_DELIVERY_STATUS_UNAVAILABLE_TTL_MS };
			this.remember(key, stuck);
			return stuck;
		}
		const check = this.check(key, tenantId, organizationId)
			.then((available) => {
				const checkedAt = new Date(this.now());
				const ttl = available ? INBOX_DELIVERY_STATUS_AVAILABLE_TTL_MS : INBOX_DELIVERY_STATUS_UNAVAILABLE_TTL_MS;
				const result = { available, checkedAt, expiresAt: checkedAt.getTime() + ttl };
				this.remember(key, result);
				return result;
			})
			.finally(() => this.pending.delete(key));
		this.pending.set(key, check);
		return check;
	}

	/** Whether email can go out for the scope: a transport answers, and its recent sends are not all failing. */
	private async check(key: string, tenantId: ID, organizationId: ID | null): Promise<boolean> {
		// The time limit covers the whole check: the transport lookup and the read of the delivery log.
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<boolean>((resolve) => {
			timer = setTimeout(() => resolve(false), INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS);
			timer.unref?.();
		});
		const checked = (async () => {
			if (!(await this.transportAnswers(tenantId, organizationId))) return false;
			return !(await this.sendsFailing(tenantId, organizationId));
		})();
		this.inflight.set(key, checked);
		checked.catch(() => false).finally(() => this.inflight.delete(key));
		try {
			return await Promise.race([checked, timeout]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	/**
	 * Whether the scope's latest email attempts are failed sends, enough of them in a row, with none sent in between.
	 * A log that cannot be read says nothing (the transport's answer stands).
	 */
	private async sendsFailing(tenantId: ID, organizationId: ID | null): Promise<boolean> {
		try {
			const since = new Date(this.now() - INBOX_DELIVERY_STATUS_HISTORY_MS);
			const scope = {
				tenantId,
				organizationId: organizationId ?? IsNull(),
				channel: InboxDeliveryChannelEnum.EMAIL,
				updatedAt: MoreThanOrEqual(since)
			};
			// Attempted rows only (sent, or a send that failed): a skipped or still-due row is not read at all.
			const rows = await this.dataSource.getRepository(InboxDelivery).find({
				select: { id: true, userId: true, sentAt: true, lastError: true, attempts: true, updatedAt: true },
				where: [
					{ ...scope, sentAt: Not(IsNull()) },
					{ ...scope, sentAt: IsNull(), lastError: Not(IsNull()), attempts: MoreThan(0) }
				],
				order: { updatedAt: 'DESC' },
				take: INBOX_DELIVERY_STATUS_HISTORY_ROWS
			});
			// One email can stand for several rows (a digest records its outcome on every entry it carried, at once), so
			// failures are counted per send: one person and one moment.
			const failedSends = new Set<string>();
			for (const row of rows) {
				if (row.sentAt) break;
				// A failed send was attempted; a skip (no address, nothing to say) or a row still due was not.
				if (row.lastError && (row.attempts ?? 0) > 0) {
					failedSends.add(`${row.userId}|${row.updatedAt ? new Date(row.updatedAt).getTime() : row.id}`);
				}
			}
			return failedSends.size >= INBOX_DELIVERY_STATUS_FAILURES_IN_A_ROW;
		} catch (error) {
			this.logger.debug(`The delivery log of tenant ${tenantId} was not read: ${(error as Error)?.message}`);
			return false;
		}
	}

	/** Whether a transport answers for the scope, within the time limit. */
	private transportAnswers(tenantId: ID, organizationId: ID | null): Promise<boolean> {
		return this.sender
			.getEmailInstance({ tenantId, organizationId: organizationId ?? undefined })
			.then((instance) => !!instance)
			.catch((error) => {
				this.logger.debug(`No mail transport answers for tenant ${tenantId}: ${(error as Error)?.message}`);
				return false;
			});
	}

	private remember(key: string, result: ITransportCheck): void {
		this.checks.delete(key);
		this.checks.set(key, result);
		while (this.checks.size > INBOX_DELIVERY_STATUS_MAX_ENTRIES) {
			const oldest = this.checks.keys().next().value;
			if (oldest === undefined) break;
			this.checks.delete(oldest);
		}
	}
}
