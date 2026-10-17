import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	ID,
	IInboxEmailDelivered,
	IInboxEmailHandoff,
	IInboxEmailHandoffListener,
	IInboxEmailHandoffs,
	InboxEmailDirectionEnum,
	InboxEmailStatusEnum
} from '@gauzy/contracts';
import { InboxEmail } from '../entities/inbox-email.entity';
import { InboxEmailAttachment } from '../entities/inbox-email-attachment.entity';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';

/** Parses a JSON column; a malformed document reads as `null`. */
function json<T>(value: string | null | undefined): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

/** The addresses of a `{ address, name? }[]` column (an `{ address }` object counts as one). */
function addresses(value: string | null | undefined): string[] {
	const parsed = json<unknown>(value);
	const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
	return rows
		.map((row) => (row && typeof (row as { address?: unknown }).address === 'string' ? (row as { address: string }).address : null))
		.filter((address): address is string => !!address);
}

/**
 * The hand-off seam of the Inbox email features (plan 04 §5.3 step 7, §6 — P4c): plugins that route a mailbox
 * elsewhere (the Ever Works agent bridge) register a listener, are told about every message the pipeline delivers,
 * and read the stored message when they act on it. The Inbox depends on none of them (`INBOX_EMAIL_HANDOFFS`).
 *
 * A listener never fails or delays a delivery: it is called after the message is `PROCESSED`, and its error is
 * logged. A listener that must not lose a message keeps its own durable queue (the Ever Works bridge enqueues an
 * outbound change, retried with back-off).
 */
@Injectable()
export class InboxEmailHandoffs implements IInboxEmailHandoffs {
	private readonly logger = new Logger('InboxEmailHandoffs');
	private readonly listeners = new Map<string, IInboxEmailHandoffListener>();

	constructor(private readonly dataSource: DataSource) {}

	register(listener: IInboxEmailHandoffListener): void {
		this.listeners.set(listener.id, listener);
	}

	unregister(id: string): void {
		this.listeners.delete(id);
	}

	/** Tells every listener about a delivered message (best effort, in registration order). */
	async delivered(email: InboxEmail, mailbox: InboxMailbox, inboxItemId: ID | null): Promise<void> {
		if (!this.listeners.size) return;
		const notice: IInboxEmailDelivered = {
			tenantId: email.tenantId as ID,
			organizationId: (email.organizationId as ID) ?? null,
			mailboxId: mailbox.id as ID,
			mailboxSettings: json<Record<string, unknown>>(mailbox.settings),
			emailId: email.id as ID,
			inboxItemId
		};
		for (const listener of this.listeners.values()) {
			try {
				await listener.delivered(notice);
			} catch (error) {
				this.logger.warn(
					`Inbox email ${email.id}: the hand-off listener ${listener.id} failed (${(error as Error)?.message ?? error}).`
				);
			}
		}
	}

	/** The stored, delivered inbound message of a tenant, for its hand-off; `null` otherwise. */
	async read(tenantId: ID, emailId: ID): Promise<IInboxEmailHandoff | null> {
		const email = await this.dataSource.getRepository(InboxEmail).findOne({ where: { id: emailId, tenantId } });
		if (!email || email.deletedAt) return null;
		if (email.direction !== InboxEmailDirectionEnum.IN || email.status !== InboxEmailStatusEnum.PROCESSED) return null;
		const mailbox = await this.dataSource
			.getRepository(InboxMailbox)
			.findOne({ where: { id: email.mailboxId, tenantId } });
		if (!mailbox) return null;
		const attachments = await this.dataSource
			.getRepository(InboxEmailAttachment)
			.find({ where: { emailId, tenantId }, order: { filename: 'ASC' } });
		return {
			tenantId,
			organizationId: (email.organizationId as ID) ?? null,
			mailboxId: mailbox.id as ID,
			mailboxAddress: mailbox.address,
			mailboxSettings: json<Record<string, unknown>>(mailbox.settings),
			emailId,
			inboxItemId: (email.inboxItemId as ID) ?? null,
			from: addresses(email.sender)[0] ?? null,
			to: addresses(email.toAddresses),
			cc: addresses(email.ccAddresses),
			subject: email.subject ?? null,
			text: email.textBody ?? null,
			html: email.htmlSanitized ?? null,
			messageId: email.messageId ?? null,
			inReplyTo: email.inReplyTo ?? null,
			references: (json<unknown[]>(email.referenceIds) ?? []).filter((id): id is string => typeof id === 'string'),
			attachments: attachments
				.filter((row) => !row.isInline)
				.map((row) => ({
					filename: row.filename,
					contentType: row.contentType || 'application/octet-stream',
					size: typeof row.size === 'number' ? row.size : null
				})),
			receivedAt: email.receivedAt ?? null
		};
	}
}
