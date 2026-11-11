import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID, IInboxDeliveryStatus } from '@gauzy/contracts';
import { EmailSendService, RequestContext } from '@gauzy/core';
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

interface ITransportCheck {
	available: boolean;
	checkedAt: Date;
	expiresAt: number;
}

/**
 * Whether the Inbox can deliver through email and web push for the caller's tenant and organization.
 *
 * Email needs both the flag and a transport: the platform's resolution (a provider account, the organization's SMTP,
 * the tenant's, then the server's `MAIL_*`) verifies the connection, so the answer is cached per tenant and
 * organization, one check runs at a time per scope, and a check that hangs counts as unavailable after
 * {@link INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS}. Nothing about the transport (host, account, error) is returned.
 */
@Injectable()
export class InboxDeliveryStatusService {
	private readonly logger = new Logger(InboxDeliveryStatusService.name);
	private readonly checks = new Map<string, ITransportCheck>();
	private readonly pending = new Map<string, Promise<ITransportCheck>>();

	/** The clock (a spec replaces it). */
	protected now: () => number = () => Date.now();

	constructor(@Inject(EmailSendService) private readonly sender: EmailSendService) {}

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
		const check = this.check(tenantId, organizationId)
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

	/** Whether a transport answers for the scope, within the time limit. */
	private async check(tenantId: ID, organizationId: ID | null): Promise<boolean> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<boolean>((resolve) => {
			timer = setTimeout(() => resolve(false), INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS);
			timer.unref?.();
		});
		const lookup = this.sender
			.getEmailInstance({ tenantId, organizationId: organizationId ?? undefined })
			.then((instance) => !!instance)
			.catch((error) => {
				this.logger.debug(`No mail transport answers for tenant ${tenantId}: ${(error as Error)?.message}`);
				return false;
			});
		try {
			return await Promise.race([lookup, timeout]);
		} finally {
			if (timer) clearTimeout(timer);
		}
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
