// cspell:ignore dmarc
import {
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	PayloadTooLargeException,
	UnauthorizedException
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
	ID,
	IInboxInboundResult,
	InboxEmailDirectionEnum,
	InboxEmailStatusEnum,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxProviderAccountScopeEnum
} from '@gauzy/contracts';
import { InboxEmail } from '../entities/inbox-email.entity';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { GENERIC_PROVIDER_ID, PLATFORM_ACCOUNT_ID } from '../inbox-email.constants';
import { isSenderAllowed, normalizeAddresses } from '../mailboxes/address';
import { InboxMailboxAccessService } from '../mailboxes/inbox-mailbox-access.service';
import { InboxProviderAccountService } from '../provider-accounts/inbox-provider-account.service';
import { EmailProviderRegistry } from '../providers/email-provider.registry';
import { IInboundWebhookRequest, IProviderAccountContext, ParsedInboundEmail } from '../providers/email-provider.types';
import { getInboxEmailConfig, InboxEmailConfig } from './inbox-email.config';
import { InboxEmailStorage } from './inbox-email-storage';
import { INBOX_EMAIL_PROCESSOR, IInboxEmailProcessor } from './inbox-email-processor.types';
import { serializeParsedMessage } from './mime';

/** The JSON array text of a value (`null` for nothing). */
const json = (value: unknown): string | null =>
	value === undefined || value === null || (Array.isArray(value) && value.length === 0)
		? null
		: JSON.stringify(value);

/** A message's mailbox scope, after the account check. */
interface MatchedMailbox {
	mailbox: InboxMailbox;
	tag?: string;
}

/**
 * The provider webhook (plan 04 §5.3), which must be fast: it proves the request, stores what it carries and
 * answers 202; the worker does the rest.
 *
 * 1. The account: the platform route (`/inbound/generic/platform`, configured from `GAUZY_INBOX_PLATFORM_SECRET`) or
 *    a provider account by id — not disabled, of the provider the URL names. Anything else answers 404.
 * 2. `provider.inbound.verify` (401 when the request is not proven), then `parse`.
 * 3. Per message: only the envelope recipients (or `To` / `Cc` when the provider gives no envelope) that are active
 *    mailboxes **of this account** count — a mailbox receives only through the account it points at (the platform
 *    route: mailboxes without an account), in the account's tenant (and organization, for an organization's account);
 *    a custom-domain mailbox only once its domain is verified; and only from senders its allowlist admits. The
 *    mailbox row decides the tenant and the organization, never the payload. Other recipients are dropped.
 * 4. The raw message (`.eml`, or the normalized `.json`) goes to FileStorage once per tenant, and one `inbox_email`
 *    row per mailbox (`RECEIVED`, unique on `(mailboxId, messageId)`: a provider's retry is counted as a duplicate).
 * 5. The rows are handed to the worker; the answer is `{ accepted, duplicates, dropped }` with 202.
 */
@Injectable()
export class InboxInboundService {
	private readonly logger = new Logger(InboxInboundService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly providers: EmailProviderRegistry,
		private readonly accounts: InboxProviderAccountService,
		private readonly mailboxes: InboxMailboxAccessService,
		private readonly storage: InboxEmailStorage,
		@Inject(INBOX_EMAIL_PROCESSOR) private readonly processor: IInboxEmailProcessor
	) {}

	/** Reads the settings per call, so a test (or a restart-free change) sees the current environment. */
	protected config(): InboxEmailConfig {
		return getInboxEmailConfig();
	}

	async receive(
		providerId: string,
		accountId: string,
		request: IInboundWebhookRequest
	): Promise<IInboxInboundResult> {
		const config = this.config();
		const provider = this.providers.get(providerId);
		if (!provider?.inbound || !provider.capabilities.inbound) {
			throw new NotFoundException();
		}
		const account = await this.account(providerId, accountId, config);
		if ((request.rawBody?.length ?? 0) > config.maxMessageBytes * 1.5) {
			throw new PayloadTooLargeException('The delivery is larger than this server accepts.');
		}

		try {
			await provider.inbound.verify(request, account);
		} catch (error) {
			this.logger.warn(`Refused an unverified ${providerId} delivery for account ${accountId}.`);
			throw error instanceof UnauthorizedException
				? error
				: new UnauthorizedException('The delivery is not verified.');
		}

		const messages = await provider.inbound.parse(request, account);
		const result: IInboxInboundResult = { accepted: 0, duplicates: 0, dropped: 0 };
		const created: ID[] = [];
		for (const message of messages) {
			await this.store(message, account, config, result, created);
		}
		for (const id of created) {
			this.processor.enqueue(id);
		}
		if (result.dropped > 0) {
			this.logger.log(
				`Inbound ${providerId}: ${result.accepted} stored, ${result.duplicates} duplicate(s), ${result.dropped} dropped.`
			);
		}
		return result;
	}

	/** The account a request is for, with its configuration decrypted; 404 for anything that is not one. */
	private async account(
		providerId: string,
		accountId: string,
		config: InboxEmailConfig
	): Promise<IProviderAccountContext> {
		if (providerId === GENERIC_PROVIDER_ID && accountId === PLATFORM_ACCOUNT_ID) {
			if (!config.platformSecret) {
				// The platform route is shut until the operator sets its secret.
				throw new NotFoundException();
			}
			return {
				id: null,
				providerId,
				tenantId: null,
				organizationId: null,
				scope: null,
				config: { signingSecret: config.platformSecret }
			};
		}
		const row = await this.accounts.findUsable(accountId);
		if (!row || row.providerId !== providerId) {
			throw new NotFoundException();
		}
		try {
			return this.accounts.context(row);
		} catch (error) {
			// The account's credentials cannot be read with this process's key: nothing can be verified.
			this.logger.warn(`Provider account ${row.id} cannot be read: ${(error as Error)?.message}`);
			throw new NotFoundException();
		}
	}

	private async store(
		message: ParsedInboundEmail,
		account: IProviderAccountContext,
		config: InboxEmailConfig,
		result: IInboxInboundResult,
		created: ID[]
	): Promise<void> {
		const size = message.raw?.length ?? message.sizeBytes ?? 0;
		const recipients = normalizeAddresses(
			message.envelopeRecipients.length > 0
				? message.envelopeRecipients
				: [...message.to, ...message.cc].map((entry) => entry.address)
		);
		if (size > config.maxMessageBytes) {
			result.dropped += Math.max(1, recipients.length);
			return;
		}
		const matched = await this.match(recipients, message, account);
		result.dropped += recipients.length - matched.length;
		if (matched.length === 0) return;

		const messageId = (message.messageId as string).slice(0, 512);
		// One stored raw message per tenant (FileStorage keys are per tenant).
		const byTenant = new Map<ID, MatchedMailbox[]>();
		for (const entry of matched) {
			const tenantId = entry.mailbox.tenantId as ID;
			byTenant.set(tenantId, [...(byTenant.get(tenantId) ?? []), entry]);
		}
		for (const [tenantId, entries] of byTenant) {
			const fresh: MatchedMailbox[] = [];
			for (const entry of entries) {
				const exists = await this.dataSource
					.getRepository(InboxEmail)
					.findOne({ where: { mailboxId: entry.mailbox.id as ID, messageId }, select: { id: true } });
				if (exists) result.duplicates += 1;
				else fresh.push(entry);
			}
			if (fresh.length === 0) continue;

			const extension = message.raw ? 'eml' : 'json';
			const now = new Date();
			const key = `inbox/${tenantId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${extension}`;
			const stored = await this.storage.put(message.raw ?? serializeParsedMessage(message), key);

			for (const { mailbox, tag } of fresh) {
				try {
					const row = await this.dataSource.getRepository(InboxEmail).save(
						this.dataSource.getRepository(InboxEmail).create({
							tenantId,
							organizationId: mailbox.organizationId ?? null,
							mailboxId: mailbox.id as ID,
							direction: InboxEmailDirectionEnum.IN,
							messageId,
							inReplyTo: message.inReplyTo?.slice(0, 512) ?? null,
							referenceIds: json(message.references),
							sender: json(message.from ?? null),
							toAddresses: json(message.to),
							ccAddresses: json(message.cc),
							replyToAddresses: json(message.replyTo),
							subject: message.subject?.slice(0, 500) ?? null,
							headers: json(tag ? { ...message.headers, 'x-gauzy-inbox-tag': tag } : message.headers),
							spf: message.spf ?? null,
							dkim: message.dkim ?? null,
							dmarc: message.dmarc ?? null,
							...(typeof message.spamScore === 'number' ? { spamScore: message.spamScore } : {}),
							receivedAt: message.receivedAt,
							...(message.sentAt ? { sentAt: message.sentAt } : {}),
							sizeBytes: size,
							rawStorageKey: stored.key,
							rawStorageProvider: stored.provider,
							status: InboxEmailStatusEnum.RECEIVED,
							...(account.id ? { providerAccountId: account.id } : {}),
							providerMessageId: message.providerMessageId?.slice(0, 255) ?? null,
							attemptCount: 0
						} as InboxEmail)
					);
					result.accepted += 1;
					created.push(row.id as ID);
				} catch (error) {
					// An overlapping delivery of the same message stored it between the check and the insert.
					const raced = await this.dataSource
						.getRepository(InboxEmail)
						.findOne({ where: { mailboxId: mailbox.id as ID, messageId }, select: { id: true } });
					if (!raced) throw error;
					result.duplicates += 1;
				}
			}
		}
	}

	/** The recipients that are active mailboxes this account may deliver to (the rules of step 3). */
	private async match(
		recipients: ReturnType<typeof normalizeAddresses>,
		message: ParsedInboundEmail,
		account: IProviderAccountContext
	): Promise<MatchedMailbox[]> {
		const rows = await this.mailboxes.findActiveByAddresses(recipients.map((entry) => entry.address));
		const byAddress = new Map(rows.map((row) => [row.address, row]));
		const sender = message.from?.address ?? message.envelopeFrom;
		const out: MatchedMailbox[] = [];
		for (const recipient of recipients) {
			const mailbox = byAddress.get(recipient.address);
			if (!mailbox || !this.accepts(mailbox, account)) continue;
			if (
				mailbox.kind === InboxMailboxKindEnum.CUSTOM_DOMAIN &&
				mailbox.domainStatus !== InboxMailboxDomainStatusEnum.VERIFIED
			) {
				continue;
			}
			if (!isSenderAllowed(this.allowlist(mailbox), sender)) continue;
			out.push(recipient.tag ? { mailbox, tag: recipient.tag } : { mailbox });
		}
		return out;
	}

	/** Whether the mailbox receives through this account (the platform route: mailboxes without an account). */
	private accepts(mailbox: InboxMailbox, account: IProviderAccountContext): boolean {
		if (account.id === null) {
			return !mailbox.providerAccountId;
		}
		if (mailbox.providerAccountId !== account.id || mailbox.tenantId !== account.tenantId) {
			return false;
		}
		return (
			account.scope !== InboxProviderAccountScopeEnum.ORGANIZATION ||
			mailbox.organizationId === account.organizationId
		);
	}

	private allowlist(mailbox: InboxMailbox): string[] {
		if (!mailbox.senderAllowlist) return [];
		try {
			const parsed = JSON.parse(mailbox.senderAllowlist) as unknown;
			return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
		} catch {
			return [];
		}
	}
}
