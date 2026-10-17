// cspell:ignore dmarc
import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { isUUID } from 'class-validator';
import { DataSource, In, IsNull } from 'typeorm';
import {
	ID,
	IInboxEmail,
	IInboxEmailAddress,
	IInboxEmailAttachment,
	IInboxEmailForwardInput,
	IInboxEmailReplyInput,
	InboxEmailDirectionEnum,
	InboxEmailSpamVerdictEnum,
	InboxEmailStatusEnum
} from '@gauzy/contracts';
import { describeEmailSendError, EmailSendService, IOutboundEmailMessage, RequestContext } from '@gauzy/core';
import { InboxItemRecipient } from '../../entities/inbox-item-recipient.entity';
import { InboxEmail } from '../entities/inbox-email.entity';
import { InboxEmailAttachment } from '../entities/inbox-email-attachment.entity';
import { InboxEmailThread } from '../entities/inbox-email-thread.entity';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { InboxEmailStorage } from '../inbound/inbox-email-storage';
import { countThreadMessages, InboxEmailProcessor } from '../inbound/inbox-email.processor';
import { messageIdOf, referencesOf } from '../inbound/mime';
import { normalizeAddress } from '../mailboxes/address';
import { InboxMailboxAccessService } from '../mailboxes/inbox-mailbox-access.service';

/** The most recipients a reply or a forward may name. */
export const MAX_OUTBOUND_RECIPIENTS = 50;
export const MAX_OUTBOUND_TEXT = 100_000;

const parse = <T>(value: string | null | undefined, fallback: T): T => {
	if (!value) return fallback;
	try {
		return (JSON.parse(value) as T) ?? fallback;
	} catch {
		return fallback;
	}
};

/** A file the API answers as a download. */
export interface InboxEmailDownload {
	content: Buffer;
	filename: string;
	contentType: string;
}

/**
 * The stored messages (plan 04 §3 `/emails`): read one (sanitized HTML, attachment metadata), its thread, its raw
 * source and attachments; reply and forward from the mailbox's address through the core transport seam (plan 04
 * §5.5); the quarantine of a mailbox and its release.
 *
 * A caller reads a message when it is addressed to them (an inbox item recipient), when they are one of the mailbox's
 * recipients, or with `INBOX_MAILBOX_READ_ALL` in the tenant. The raw source, the quarantine and its release need the
 * mailbox's management (see `InboxMailboxAccessService`). Replies and forwards send as the mailbox, so they need
 * **current** access to it (a former member keeps reading what was addressed to them, but no longer sends from it).
 * Everything is scoped to the caller's tenant; a message of another tenant does not exist.
 */
@Injectable()
export class InboxEmailService {
	private readonly logger = new Logger(InboxEmailService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly access: InboxMailboxAccessService,
		private readonly storage: InboxEmailStorage,
		private readonly processor: InboxEmailProcessor,
		@Inject(EmailSendService) private readonly sender: EmailSendService
	) {}

	async get(id: ID): Promise<IInboxEmail> {
		const { email } = await this.readable(id);
		const attachments = await this.dataSource
			.getRepository(InboxEmailAttachment)
			.find({ where: { emailId: email.id as ID }, order: { createdAt: 'ASC' } });
		return { ...this.toEmail(email), attachments: attachments.map((row) => this.toAttachment(row)) };
	}

	/** The messages of the message's thread the caller may read, oldest first. */
	async thread(id: ID): Promise<IInboxEmail[]> {
		const { email, mailbox } = await this.readable(id);
		if (!email.threadId) return [this.toEmail(email)];
		const found = await this.dataSource.getRepository(InboxEmail).find({
			where: {
				tenantId: email.tenantId as ID,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
				status: In([
					InboxEmailStatusEnum.PROCESSED,
					InboxEmailStatusEnum.SENT,
					InboxEmailStatusEnum.QUEUED,
					InboxEmailStatusEnum.FAILED
				]),
				deletedAt: IsNull()
			},
			// In the order they were stored: received, then sent (a sent message has no receivedAt).
			order: { createdAt: 'ASC' },
			take: 200
		});
		// A failed message is shown only when it is an unsent reply or forward (failed inbound work is not mail).
		let rows = found.filter(
			(row) => row.status !== InboxEmailStatusEnum.FAILED || row.direction === InboxEmailDirectionEnum.OUT
		);
		// Without current access to the mailbox (a former member reading an old message): only the messages that were
		// addressed to the caller.
		const userId = RequestContext.currentUserId() as ID;
		if (!(await this.access.canRead(mailbox, userId))) {
			const itemIds = rows.map((row) => row.inboxItemId).filter((value): value is ID => !!value);
			const mine = new Set(
				itemIds.length === 0
					? []
					: (
							await this.dataSource
								.getRepository(InboxItemRecipient)
								.find({ where: { inboxItemId: In(itemIds), userId, tenantId: email.tenantId as ID } })
						).map((recipient) => recipient.inboxItemId)
			);
			rows = rows.filter((row) => row.id === email.id || (!!row.inboxItemId && mine.has(row.inboxItemId)));
		}
		const at = (row: InboxEmail) => new Date(row.receivedAt ?? row.sentAt ?? row.createdAt ?? 0).getTime();
		return [...rows].sort((a, b) => at(a) - at(b)).map((row) => this.toEmail(row));
	}

	/** The raw source (`.eml`, or the normalized JSON): mailbox management only. */
	async raw(id: ID): Promise<InboxEmailDownload> {
		const { email, mailbox } = await this.readable(id);
		await this.assertManage(mailbox);
		if (!email.rawStorageKey) throw new NotFoundException('This message has no stored source.');
		const content = await this.storage.get({ key: email.rawStorageKey, provider: email.rawStorageProvider ?? '' });
		const eml = !email.rawStorageKey.endsWith('.json');
		return {
			content,
			filename: `message-${email.id}.${eml ? 'eml' : 'json'}`,
			contentType: eml ? 'message/rfc822' : 'application/json'
		};
	}

	async attachment(id: ID, attachmentId: ID): Promise<InboxEmailDownload> {
		const { email } = await this.readable(id);
		const row = isUUID(attachmentId)
			? await this.dataSource
					.getRepository(InboxEmailAttachment)
					.findOne({ where: { id: attachmentId, emailId: email.id as ID } })
			: null;
		if (!row) throw new NotFoundException('The attachment does not exist.');
		return {
			content: await this.storage.get({ key: row.storageKey, provider: row.storageProvider ?? '' }),
			filename: row.filename,
			contentType: row.contentType || 'application/octet-stream'
		};
	}

	/** The quarantined messages of a mailbox: mailbox management only. */
	async quarantine(mailboxId: ID): Promise<IInboxEmail[]> {
		const mailbox = await this.mailbox(mailboxId);
		await this.assertManage(mailbox);
		const rows = await this.dataSource.getRepository(InboxEmail).find({
			where: { mailboxId: mailbox.id as ID, status: InboxEmailStatusEnum.QUARANTINED, deletedAt: IsNull() },
			order: { receivedAt: 'DESC' },
			take: 200
		});
		return rows.map((row) => this.toEmail(row));
	}

	/** Releases a quarantined message: it becomes an inbox item of the mailbox's recipients. */
	async release(id: ID): Promise<IInboxEmail> {
		// The managers' business: authorized by the management check alone (a manager need not be a recipient).
		const tenantId = RequestContext.currentTenantId();
		const email =
			tenantId && isUUID(id)
				? await this.dataSource.getRepository(InboxEmail).findOne({ where: { id, tenantId } })
				: null;
		if (!email || email.deletedAt) throw new NotFoundException('The message does not exist.');
		const mailbox = await this.mailbox(email.mailboxId);
		await this.assertManage(mailbox);
		if (email.status !== InboxEmailStatusEnum.QUARANTINED) {
			throw new BadRequestException('Only a quarantined message can be released.');
		}
		await this.processor.release(email);
		const released = (await this.dataSource.getRepository(InboxEmail).findOne({ where: { id } })) as InboxEmail;
		const attachments = await this.dataSource
			.getRepository(InboxEmailAttachment)
			.find({ where: { emailId: id }, order: { createdAt: 'ASC' } });
		return { ...this.toEmail(released), attachments: attachments.map((row) => this.toAttachment(row)) };
	}

	/**
	 * Replies from the mailbox's address, in the message's thread (`In-Reply-To` / `References`). A reply to a message
	 * the mailbox sent goes to that message's recipients again (a follow-up), never back to the mailbox.
	 */
	async reply(id: ID, input: IInboxEmailReplyInput): Promise<IInboxEmail> {
		const { email, mailbox } = await this.sendable(id);
		const text = this.text(input?.text, true);
		const original = this.toEmail(email);
		const followUp = email.direction === InboxEmailDirectionEnum.OUT;
		const to = followUp
			? original.to
			: original.replyTo.length > 0
				? original.replyTo
				: original.from
					? [original.from]
					: [];
		const others = input?.replyAll ? (followUp ? original.cc : [...original.to, ...original.cc]) : [];
		const cc = this.addresses(
			[...others.map((entry) => entry.address), ...(input?.cc ?? [])],
			[mailbox.address, ...to.map((entry) => entry.address)]
		);
		const recipients = this.addresses(
			to.map((entry) => entry.address),
			[mailbox.address]
		);
		if (recipients.length === 0) throw new BadRequestException('The message has no address to reply to.');
		const references = [...original.references, original.messageId].filter(Boolean).slice(-50);
		return this.send(mailbox, email, {
			to: recipients,
			cc,
			subject: this.prefixed('Re', original.subject),
			text: `${text}\n\n${this.quote(original)}`,
			inReplyTo: original.messageId,
			references
		});
	}

	/** Forwards the message (with its attachments unless stated otherwise) from the mailbox's address. */
	async forward(id: ID, input: IInboxEmailForwardInput): Promise<IInboxEmail> {
		const { email, mailbox } = await this.sendable(id);
		const to = this.addresses(input?.to ?? [], [mailbox.address]);
		if (to.length === 0) throw new BadRequestException('A forward needs at least one recipient.');
		const original = this.toEmail(email);
		const note = this.text(input?.text, false);
		// Every stored attachment (the worker keeps at most 100 per message): a forward is never a partial copy.
		const stored =
			input?.includeAttachments === false
				? []
				: await this.dataSource
						.getRepository(InboxEmailAttachment)
						.find({ where: { emailId: email.id as ID }, order: { createdAt: 'ASC' } });
		const attachments = await Promise.all(
			stored.map(async (row) => ({
				filename: row.filename,
				content: await this.storage.get({ key: row.storageKey, provider: row.storageProvider ?? '' }),
				...(row.contentType ? { contentType: row.contentType } : {}),
				...(row.contentId && row.isInline ? { cid: row.contentId } : {})
			}))
		);
		return this.send(
			mailbox,
			email,
			{
				to,
				cc: [],
				subject: this.prefixed('Fwd', original.subject),
				text: `${note ? `${note}\n\n` : ''}---------- Forwarded message ----------\n${this.quote(original, false)}`,
				attachments
			},
			stored
		);
	}

	// ---------------------------------------------------------------- helpers

	/**
	 * Sends through the core transport seam (the mailbox's provider account first, then the organization's and the
	 * tenant's outbound accounts, then Custom SMTP / `MAIL_*`) and keeps the message as `OUT` in the thread, with the
	 * attachments it carried (their stored files are shared, never copied). Recipients the server refused are kept in
	 * the message's `error`; a message no recipient took is `FAILED`. A failed send answers 502 with the kept message's
	 * id, so the unsent text can be found in the thread.
	 */
	private async send(
		mailbox: InboxMailbox,
		original: InboxEmail,
		message: Omit<IOutboundEmailMessage, 'from' | 'to' | 'cc'> & { to: string[]; cc: string[] },
		storedAttachments: InboxEmailAttachment[] = []
	): Promise<IInboxEmail> {
		const repository = this.dataSource.getRepository(InboxEmail);
		const domain = mailbox.address.slice(mailbox.address.lastIndexOf('@') + 1);
		const messageId = `<${Date.now().toString(36)}.${randomBytes(9).toString('hex')}@${domain}>`;
		const from = mailbox.displayName ? { name: mailbox.displayName, address: mailbox.address } : mailbox.address;
		const row = await repository.save(
			repository.create({
				tenantId: mailbox.tenantId,
				organizationId: mailbox.organizationId ?? null,
				mailboxId: mailbox.id as ID,
				...(original.threadId ? { threadId: original.threadId } : {}),
				direction: InboxEmailDirectionEnum.OUT,
				messageId,
				inReplyTo: message.inReplyTo ?? null,
				referenceIds: message.references ? JSON.stringify(message.references) : null,
				sender: JSON.stringify(typeof from === 'string' ? { address: from } : from),
				toAddresses: JSON.stringify(message.to.map((address) => ({ address }))),
				ccAddresses: message.cc.length ? JSON.stringify(message.cc.map((address) => ({ address }))) : null,
				subject: message.subject.slice(0, 500),
				textBody: message.text ?? null,
				snippet: (message.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || null,
				status: InboxEmailStatusEnum.QUEUED,
				...(mailbox.providerAccountId ? { providerAccountId: mailbox.providerAccountId } : {}),
				attemptCount: 1
			} as InboxEmail)
		);
		const attachmentRepository = this.dataSource.getRepository(InboxEmailAttachment);
		// The attachment rows inside the send's try: a failure marks the kept message FAILED, never a QUEUED orphan.
		// They are saved in one call (one transaction): a FAILED message never keeps part of its attachments.
		try {
			await attachmentRepository.save(
				storedAttachments.map((stored) =>
					attachmentRepository.create({
						tenantId: stored.tenantId,
						organizationId: stored.organizationId ?? null,
						emailId: row.id as ID,
						filename: stored.filename,
						contentType: stored.contentType ?? null,
						size: stored.size,
						sha256: stored.sha256 ?? null,
						storageKey: stored.storageKey,
						storageProvider: stored.storageProvider ?? null,
						...(stored.contentId ? { contentId: stored.contentId } : {}),
						isInline: !!stored.isInline
					} as InboxEmailAttachment)
				)
			);
			const sent = await this.sender.sendMessage(
				{ ...message, from, to: message.to, ...(message.cc.length ? { cc: message.cc } : {}), messageId },
				{
					tenantId: mailbox.tenantId as ID,
					organizationId: mailbox.organizationId ?? null,
					providerAccountId: mailbox.providerAccountId ?? null
				}
			);
			const refused =
				sent.rejected.length > 0 ? `Not accepted for: ${sent.rejected.join(', ')}`.slice(0, 1000) : null;
			const nobody = sent.accepted.length === 0 && sent.rejected.length > 0;
			await repository.update(
				{ id: row.id as ID },
				{
					status: nobody ? InboxEmailStatusEnum.FAILED : InboxEmailStatusEnum.SENT,
					sentAt: new Date(),
					error: refused,
					transport: sent.transport.slice(0, 120),
					...(sent.providerMessageId
						? { providerMessageId: sent.providerMessageId.slice(0, 255) }
						: sent.messageId && sent.messageId !== messageId
							? { providerMessageId: sent.messageId.slice(0, 255) }
							: {})
				}
			);
		} catch (error) {
			const reason = describeEmailSendError(error);
			await repository.update(
				{ id: row.id as ID },
				{ status: InboxEmailStatusEnum.FAILED, error: reason.slice(0, 1000) }
			);
			this.logger.warn(`Inbox email ${row.id} was not sent: ${reason}`);
			throw new BadGatewayException({
				message: 'The message could not be sent. It is kept in the thread as not sent.',
				emailId: row.id
			});
		}
		await this.touchThread(row.threadId ?? null, mailbox.tenantId as ID);
		const sentRow = (await repository.findOne({ where: { id: row.id as ID } })) as InboxEmail;
		return {
			...this.toEmail(sentRow),
			attachments: (await attachmentRepository.find({ where: { emailId: row.id as ID } })).map((entry) =>
				this.toAttachment(entry)
			)
		};
	}

	/**
	 * A thread's count and last activity after a reply or forward joined it (recounted, never incremented; the messages
	 * the thread view shows).
	 */
	private async touchThread(threadId: ID | null, tenantId: ID): Promise<void> {
		if (!threadId) return;
		const messageCount = await countThreadMessages(this.dataSource.manager, threadId, tenantId);
		await this.dataSource
			.getRepository(InboxEmailThread)
			.update({ id: threadId }, { messageCount, lastMessageAt: new Date() });
	}

	/** The message and its mailbox, when the caller may read it (404 otherwise, so ids are not probed). */
	private async readable(id: ID): Promise<{ email: InboxEmail; mailbox: InboxMailbox }> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		if (!tenantId || !userId) throw new ForbiddenException('The inbox needs a signed-in user of a tenant.');
		const email = isUUID(id)
			? await this.dataSource.getRepository(InboxEmail).findOne({ where: { id, tenantId } })
			: null;
		const mailbox = email
			? await this.dataSource.getRepository(InboxMailbox).findOne({ where: { id: email.mailboxId, tenantId } })
			: null;
		if (!email || !mailbox || email.deletedAt) throw new NotFoundException('The message does not exist.');
		// A quarantined message is the managers' business until it is released.
		if (email.status === InboxEmailStatusEnum.QUARANTINED) {
			if (!(await this.access.canManage(mailbox, userId)))
				throw new NotFoundException('The message does not exist.');
			return { email, mailbox };
		}
		const recipient = email.inboxItemId
			? await this.dataSource
					.getRepository(InboxItemRecipient)
					.findOne({ where: { inboxItemId: email.inboxItemId, userId, tenantId } })
			: null;
		if (!recipient && !(await this.access.canRead(mailbox, userId))) {
			throw new NotFoundException('The message does not exist.');
		}
		return { email, mailbox };
	}

	/**
	 * The message and its mailbox, when the caller may send as the mailbox: read access to the message and current
	 * access to the mailbox (an old inbox item recipient row is not enough).
	 */
	private async sendable(id: ID): Promise<{ email: InboxEmail; mailbox: InboxMailbox }> {
		const found = await this.readable(id);
		if (!(await this.access.canRead(found.mailbox, RequestContext.currentUserId() as ID))) {
			throw new ForbiddenException('Sending from this mailbox needs current access to it.');
		}
		return found;
	}

	private async mailbox(id: ID): Promise<InboxMailbox> {
		const tenantId = RequestContext.currentTenantId();
		const mailbox =
			tenantId && isUUID(id)
				? await this.dataSource.getRepository(InboxMailbox).findOne({ where: { id, tenantId } })
				: null;
		if (!mailbox) throw new NotFoundException('The mailbox does not exist.');
		return mailbox;
	}

	private async assertManage(mailbox: InboxMailbox): Promise<void> {
		const userId = RequestContext.currentUserId();
		if (!userId || !(await this.access.canManage(mailbox, userId))) {
			throw new ForbiddenException('Managing this mailbox is required.');
		}
	}

	private text(value: unknown, required: boolean): string {
		const text = typeof value === 'string' ? value.trim() : '';
		if (required && !text) throw new BadRequestException('A reply needs a text.');
		if (text.length > MAX_OUTBOUND_TEXT)
			throw new BadRequestException(`A message is at most ${MAX_OUTBOUND_TEXT} characters.`);
		return text;
	}

	/** Valid, distinct addresses, without the excluded ones, at most {@link MAX_OUTBOUND_RECIPIENTS}. */
	private addresses(values: unknown[], exclude: string[]): string[] {
		const skip = new Set(exclude.map((value) => normalizeAddress(value)?.address).filter(Boolean));
		const out: string[] = [];
		for (const value of values) {
			const text = typeof value === 'string' ? value.trim() : '';
			const normalized = normalizeAddress(text);
			if (!normalized) {
				if (text) throw new BadRequestException(`${text.slice(0, 80)} is not an email address.`);
				continue;
			}
			// The full address (with its +tag) is sent; the comparison uses the normalized one.
			const full = (/<([^<>]+)>\s*$/.exec(text)?.[1] ?? text).trim().toLowerCase();
			if (skip.has(normalized.address) || out.includes(full)) continue;
			out.push(full);
		}
		if (out.length > MAX_OUTBOUND_RECIPIENTS) {
			throw new BadRequestException(`A message is sent to at most ${MAX_OUTBOUND_RECIPIENTS} addresses.`);
		}
		return out;
	}

	private prefixed(prefix: 'Re' | 'Fwd', subject: string | null | undefined): string {
		const base = (subject ?? '').trim();
		return new RegExp(`^${prefix}:`, 'i').test(base) ? base : `${prefix}: ${base}`.trim();
	}

	private quote(email: IInboxEmail, asReply = true): string {
		const from = email.from
			? email.from.name
				? `${email.from.name} <${email.from.address}>`
				: email.from.address
			: '';
		const when = email.receivedAt ? new Date(email.receivedAt).toUTCString() : '';
		const body = (email.textBody ?? '').slice(0, 20_000);
		if (!asReply) {
			return [`From: ${from}`, `Date: ${when}`, `Subject: ${email.subject ?? ''}`, '', body].join('\n');
		}
		return [`On ${when}, ${from} wrote:`, ...body.split('\n').map((line) => `> ${line}`)].join('\n');
	}

	private toEmail(row: InboxEmail): IInboxEmail {
		return {
			id: row.id,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			mailboxId: row.mailboxId,
			threadId: row.threadId ?? null,
			direction: row.direction,
			messageId: messageIdOf(row.messageId) ?? row.messageId,
			inReplyTo: row.inReplyTo ?? null,
			references: referencesOf(parse<string[]>(row.referenceIds, [])),
			from: parse<IInboxEmailAddress | null>(row.sender, null),
			to: parse<IInboxEmailAddress[]>(row.toAddresses, []),
			cc: parse<IInboxEmailAddress[]>(row.ccAddresses, []),
			bcc: parse<IInboxEmailAddress[]>(row.bccAddresses, []),
			replyTo: parse<IInboxEmailAddress[]>(row.replyToAddresses, []),
			subject: row.subject ?? null,
			textBody: row.textBody ?? null,
			htmlSanitized: row.htmlSanitized ?? null,
			snippet: row.snippet ?? null,
			headers: parse<Record<string, string> | null>(row.headers, null),
			spf: row.spf ?? null,
			dkim: row.dkim ?? null,
			dmarc: row.dmarc ?? null,
			spamScore: row.spamScore ?? null,
			spamVerdict: (row.spamVerdict as InboxEmailSpamVerdictEnum | null) ?? null,
			receivedAt: row.receivedAt ?? null,
			sentAt: row.sentAt ?? null,
			sizeBytes: row.sizeBytes ?? null,
			status: row.status,
			providerMessageId: row.providerMessageId ?? null,
			error: row.error ?? null,
			inboxItemId: row.inboxItemId ?? null
		} as IInboxEmail;
	}

	private toAttachment(row: InboxEmailAttachment): IInboxEmailAttachment {
		return {
			id: row.id as ID,
			emailId: row.emailId,
			filename: row.filename,
			contentType: row.contentType ?? null,
			size: row.size,
			sha256: row.sha256 ?? null,
			contentId: row.contentId ?? null,
			isInline: !!row.isInline,
			savedDocumentId: row.savedDocumentId ?? null
		};
	}
}
