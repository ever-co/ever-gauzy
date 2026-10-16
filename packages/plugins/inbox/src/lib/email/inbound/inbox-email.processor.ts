// cspell:ignore permerror softfail dmarc
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Brackets, DataSource, EntityManager, In, IsNull, MoreThanOrEqual } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ID,
	IInboxItemWriter,
	INBOX_ITEM_WRITER,
	InboxEmailSpamVerdictEnum,
	InboxEmailStatusEnum,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import { InboxItem } from '../../entities/inbox-item.entity';
import { InboxEmail } from '../entities/inbox-email.entity';
import { InboxEmailAttachment } from '../entities/inbox-email-attachment.entity';
import { InboxEmailThread } from '../entities/inbox-email-thread.entity';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { normalizeAddress, normalizeSubject } from '../mailboxes/address';
import { InboxMailboxAccessService } from '../mailboxes/inbox-mailbox-access.service';
import { IInboundEmailAddress, ParsedInboundEmail } from '../providers/email-provider.types';
import { getInboxEmailConfig, InboxEmailConfig } from './inbox-email.config';
import { InboxEmailStorage } from './inbox-email-storage';
import { IInboxEmailProcessor } from './inbox-email-processor.types';
import { deserializeParsedMessage, parseMimeMessage } from './mime';
import { sanitizeEmailHtml, snippetOf, textFromHtml } from './sanitize';

type EmailUpdate = QueryDeepPartialEntity<InboxEmail>;

/** How many times a message is tried before it is left `FAILED`. */
export const MAX_PROCESS_ATTEMPTS = 3;
/** A `RECEIVED` message older than this is picked up by the sweep (the hand-over was lost: a restart, a crash). */
export const SWEEP_RECEIVED_AFTER_MS = 60_000;
/** A `PROCESSING` message older than this is taken over (its worker died). */
export const SWEEP_PROCESSING_AFTER_MS = 10 * 60_000;
/** How often the sweep runs, and how many messages it takes per run. */
export const SWEEP_INTERVAL_MS = 2 * 60_000;
export const SWEEP_BATCH = 50;
/** A thread is joined by subject only within this window. */
export const THREAD_SUBJECT_WINDOW_MS = 30 * 24 * 60 * 60_000;
/** The longest text body kept (the item body keeps less). */
export const MAX_TEXT_BODY = 1_000_000;
export const MAX_ITEM_BODY = 5_000;
/** MIME types that are never offered as what they claim (they could run script when opened inline). */
const ACTIVE_CONTENT_TYPES =
	/^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|application\/javascript|text\/javascript)/i;

const parseList = <T>(value: string | null | undefined): T[] => {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
};

/** A stored message's `From` (its JSON column), or `null`. */
function senderOf(email: InboxEmail): IInboundEmailAddress | null {
	if (!email.sender) return null;
	try {
		const parsed = JSON.parse(email.sender) as IInboundEmailAddress | null;
		return parsed && typeof parsed.address === 'string' ? parsed : null;
	} catch {
		return null;
	}
}

/** The spam verdict of plan 04 §5.3: authentication failures and the provider's score. */
export function spamVerdictOf(
	message: Pick<ParsedInboundEmail, 'spf' | 'dkim' | 'dmarc' | 'spamScore'>,
	config: Pick<InboxEmailConfig, 'spamSuspectScore' | 'spamQuarantineScore'>
): InboxEmailSpamVerdictEnum {
	const score = typeof message.spamScore === 'number' ? message.spamScore : null;
	const failed = (value: unknown) => value === 'fail' || value === 'permerror';
	const doubtful = (value: unknown) => value === 'softfail';
	const authFailures = [message.spf, message.dkim, message.dmarc].filter(failed).length;
	if ((score !== null && score >= config.spamQuarantineScore) || (failed(message.dmarc) && authFailures >= 2)) {
		return InboxEmailSpamVerdictEnum.SPAM;
	}
	if (authFailures > 0 || doubtful(message.spf) || (score !== null && score >= config.spamSuspectScore)) {
		return InboxEmailSpamVerdictEnum.SUSPECT;
	}
	return InboxEmailSpamVerdictEnum.HAM;
}

/**
 * The inbound worker (plan 04 §5.3). It runs in the API process: a stored message is processed on a background task
 * right after the webhook answers, and a sweep picks up any message whose hand-over was lost (`RECEIVED` for over a
 * minute) or whose worker died (`PROCESSING` for over ten minutes). Each message is claimed with a conditional update
 * first, so several API replicas never process one twice.
 *
 * Per message: read the raw message back and parse it; sanitize the HTML on the server; store the attachments (each
 * with its SHA-256; active content is never offered as what it claims); thread it (`In-Reply-To` / `References`, else
 * the normalized subject with a shared participant within 30 days); decide the spam verdict (quarantined mail gets
 * no inbox item until a mailbox manager releases it); create the `EMAIL` inbox item for the mailbox's recipients;
 * update the mailbox's counters. A failure is retried up to three times, then the message is left `FAILED` with the
 * error kept.
 */
@Injectable()
export class InboxEmailProcessor implements IInboxEmailProcessor, OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(InboxEmailProcessor.name);
	private readonly inFlight = new Set<ID>();
	/** One thread assignment at a time per mailbox in this process (the database lock covers the replicas). */
	private readonly threadLocks = new Map<ID, Promise<unknown>>();
	private timer: NodeJS.Timeout | null = null;

	constructor(
		private readonly dataSource: DataSource,
		private readonly mailboxes: InboxMailboxAccessService,
		private readonly storage: InboxEmailStorage,
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter
	) {}

	protected config(): InboxEmailConfig {
		return getInboxEmailConfig();
	}

	onApplicationBootstrap(): void {
		if (!this.config().workerEnabled) {
			this.logger.log('GAUZY_INBOX_EMAIL_WORKER=off: received messages are stored, another process works them.');
			return;
		}
		// A failed sweep (the database away) is logged; the next interval tries again.
		this.timer = setInterval(() => {
			this.sweep().catch((error) => this.logger.warn(`Inbox email sweep failed: ${(error as Error)?.message}`));
		}, SWEEP_INTERVAL_MS);
		this.timer.unref?.();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	enqueue(emailId: ID): void {
		if (!this.config().workerEnabled || this.inFlight.has(emailId)) return;
		this.inFlight.add(emailId);
		setImmediate(() => {
			this.process(emailId)
				.catch((error) => this.logger.error(`Inbox email ${emailId}: ${(error as Error)?.message}`))
				.finally(() => this.inFlight.delete(emailId));
		});
	}

	/** Hands the stale messages to the worker (see the class comment). Answers how many it took. */
	async sweep(now = new Date()): Promise<number> {
		const rows = await this.dataSource
			.getRepository(InboxEmail)
			.createQueryBuilder('email')
			.select(['email.id'])
			.where(
				new Brackets((where) => {
					where.where('(email.status = :received AND email.updatedAt < :receivedBefore)', {
						received: InboxEmailStatusEnum.RECEIVED,
						receivedBefore: new Date(now.getTime() - SWEEP_RECEIVED_AFTER_MS)
					});
					where.orWhere('(email.status = :processing AND email.updatedAt < :processingBefore)', {
						processing: InboxEmailStatusEnum.PROCESSING,
						processingBefore: new Date(now.getTime() - SWEEP_PROCESSING_AFTER_MS)
					});
				})
			)
			.andWhere('email.deletedAt IS NULL')
			.orderBy('email.updatedAt', 'ASC')
			.limit(SWEEP_BATCH)
			.getMany();
		for (const row of rows) this.enqueue(row.id as ID);
		return rows.length;
	}

	/**
	 * Processes one stored message (idempotent: a message that is not `RECEIVED`, or a stale `PROCESSING`, is left
	 * alone). Answers the status it ended in, or `null` when it did not claim the message.
	 */
	async process(emailId: ID): Promise<InboxEmailStatusEnum | null> {
		const repository = this.dataSource.getRepository(InboxEmail);
		const row = await repository.findOne({ where: { id: emailId } });
		if (!row || row.deletedAt) return null;
		const stale =
			row.status === InboxEmailStatusEnum.PROCESSING &&
			!!row.updatedAt &&
			Date.now() - new Date(row.updatedAt).getTime() >= SWEEP_PROCESSING_AFTER_MS;
		if (row.status !== InboxEmailStatusEnum.RECEIVED && !stale) return null;

		// Claim it: only one worker turns this exact state into PROCESSING.
		const claim = await repository
			.createQueryBuilder()
			.update(InboxEmail)
			.set({ status: InboxEmailStatusEnum.PROCESSING, attemptCount: (row.attemptCount ?? 0) + 1 })
			.where('id = :id AND status = :status AND attemptCount = :attempts', {
				id: emailId,
				status: row.status,
				attempts: row.attemptCount ?? 0
			})
			.execute();
		if (!claim.affected) return null;
		const attempt = (row.attemptCount ?? 0) + 1;

		try {
			const mailbox = await this.dataSource.getRepository(InboxMailbox).findOne({ where: { id: row.mailboxId } });
			if (!mailbox) throw new Error('The mailbox of the message no longer exists.');
			const message = await this.load(row);
			return await this.apply(row, mailbox, message, attempt);
		} catch (error) {
			const final = attempt >= MAX_PROCESS_ATTEMPTS;
			const owned = await this.updateClaimed(emailId, attempt, {
				status: final ? InboxEmailStatusEnum.FAILED : InboxEmailStatusEnum.RECEIVED,
				error: String((error as Error)?.message ?? error).slice(0, 1000)
			});
			if (!owned) {
				// A later attempt (another replica took the message over) owns it now: leave its state alone.
				return null;
			}
			this.logger.warn(
				`Inbox email ${emailId}: attempt ${attempt} failed${final ? ', giving up' : ''}: ${(error as Error)?.message}`
			);
			return final ? InboxEmailStatusEnum.FAILED : InboxEmailStatusEnum.RECEIVED;
		}
	}

	/**
	 * Creates the `EMAIL` inbox item of a quarantined message (a mailbox manager released it). Answers the item id.
	 */
	async release(email: InboxEmail): Promise<ID | null> {
		const mailbox = await this.dataSource.getRepository(InboxMailbox).findOne({ where: { id: email.mailboxId } });
		if (!mailbox) return null;
		const itemId = await this.deliver(email, mailbox, {
			from: senderOf(email),
			attachments: await this.dataSource
				.getRepository(InboxEmailAttachment)
				.count({ where: { emailId: email.id as ID } })
		});
		await this.dataSource.getRepository(InboxEmail).update({ id: email.id as ID }, {
			status: InboxEmailStatusEnum.PROCESSED,
			spamVerdict: InboxEmailSpamVerdictEnum.SUSPECT,
			...(itemId ? { inboxItemId: itemId } : {})
		} as EmailUpdate);
		return itemId;
	}

	// ---------------------------------------------------------------- steps

	/** The stored raw message, parsed again (`.eml` through the MIME parser, `.json` as stored). */
	private async load(row: InboxEmail): Promise<ParsedInboundEmail> {
		if (!row.rawStorageKey) throw new Error('The message has no stored raw message.');
		const buffer = await this.storage.get({ key: row.rawStorageKey, provider: row.rawStorageProvider ?? '' });
		if (row.rawStorageKey.endsWith('.json')) return deserializeParsedMessage(buffer);
		return parseMimeMessage(buffer, {
			...(row.receivedAt ? { receivedAt: new Date(row.receivedAt) } : {}),
			...(row.spf ? { spf: row.spf as ParsedInboundEmail['spf'] } : {}),
			...(row.dkim ? { dkim: row.dkim as ParsedInboundEmail['dkim'] } : {}),
			...(row.dmarc ? { dmarc: row.dmarc as ParsedInboundEmail['dmarc'] } : {}),
			...(typeof row.spamScore === 'number' ? { spamScore: row.spamScore } : {})
		});
	}

	private async apply(
		row: InboxEmail,
		mailbox: InboxMailbox,
		message: ParsedInboundEmail,
		attempt: number
	): Promise<InboxEmailStatusEnum | null> {
		const config = this.config();
		const html = message.html ? sanitizeEmailHtml(message.html) : null;
		const text = (message.text ?? (message.html ? textFromHtml(message.html) : '')).slice(0, MAX_TEXT_BODY);
		const attachments = await this.storeAttachments(row, message);
		const threadId = await this.thread(row, mailbox, message);
		const verdict = spamVerdictOf(
			{ spf: message.spf, dkim: message.dkim, dmarc: message.dmarc, spamScore: message.spamScore },
			config
		);
		const quarantined = verdict === InboxEmailSpamVerdictEnum.SPAM;

		const owned = await this.updateClaimed(row.id as ID, attempt, {
			threadId,
			textBody: text || null,
			htmlSanitized: html,
			snippet: snippetOf(text) || null,
			spamVerdict: verdict,
			error: null,
			...(quarantined ? { status: InboxEmailStatusEnum.QUARANTINED } : {})
		});
		if (!owned) return null;

		if (quarantined) {
			await this.count(mailbox);
			return InboxEmailStatusEnum.QUARANTINED;
		}
		const stored = (await this.dataSource
			.getRepository(InboxEmail)
			.findOne({ where: { id: row.id as ID } })) as InboxEmail;
		const itemId = await this.deliver(stored, mailbox, {
			from: message.from ?? null,
			attachments: attachments.length
		});
		if (
			!(await this.updateClaimed(row.id as ID, attempt, {
				status: InboxEmailStatusEnum.PROCESSED,
				...(itemId ? { inboxItemId: itemId } : {})
			}))
		) {
			return null;
		}
		await this.count(mailbox);
		return InboxEmailStatusEnum.PROCESSED;
	}

	/**
	 * Writes the state of a message this worker claimed — only while its claim is the current one (same attempt, still
	 * `PROCESSING`), so a worker that stalled past the take-over never overwrites the newer attempt's result. Answers
	 * whether it wrote.
	 */
	private async updateClaimed(id: ID, attempt: number, values: EmailUpdate): Promise<boolean> {
		const result = await this.dataSource
			.getRepository(InboxEmail)
			.createQueryBuilder()
			.update(InboxEmail)
			.set(values)
			.where('id = :id AND attemptCount = :attempt AND status = :processing', {
				id,
				attempt,
				processing: InboxEmailStatusEnum.PROCESSING
			})
			.execute();
		return !!result.affected;
	}

	/**
	 * Stores the attachments. On a retry the earlier rows of this message are replaced, and the files are written to the
	 * same keys again (index + content digest), so a retry leaves no unreachable copies behind.
	 */
	private async storeAttachments(row: InboxEmail, message: ParsedInboundEmail): Promise<InboxEmailAttachment[]> {
		const repository = this.dataSource.getRepository(InboxEmailAttachment);
		await repository.delete({ emailId: row.id as ID });
		const max = this.config().maxMessageBytes;
		const out: InboxEmailAttachment[] = [];
		for (const [index, part] of message.attachments.slice(0, 100).entries()) {
			if (!part.content?.length || part.content.length > max) continue;
			const sha256 = createHash('sha256').update(part.content).digest('hex');
			const contentType =
				part.contentType && !ACTIVE_CONTENT_TYPES.test(part.contentType)
					? part.contentType
					: 'application/octet-stream';
			const key = `inbox/${row.tenantId}/attachments/${row.id}/${index}-${sha256.slice(0, 32)}`;
			const stored = await this.storage.put(part.content, key);
			out.push(
				await repository.save(
					repository.create({
						tenantId: row.tenantId,
						organizationId: row.organizationId ?? null,
						emailId: row.id as ID,
						filename: part.filename,
						contentType: contentType.slice(0, 255),
						size: part.content.length,
						sha256,
						storageKey: stored.key,
						storageProvider: stored.provider,
						...(part.contentId ? { contentId: part.contentId.slice(0, 255) } : {}),
						isInline: !!part.isInline
					} as InboxEmailAttachment)
				)
			);
		}
		return out;
	}

	/**
	 * The thread of the message, its `threadId` set and the thread's counters recomputed. Safe to repeat (a retry, or a
	 * message a reply already put into a thread, keeps its thread), and serialised per mailbox (in this process, and
	 * across replicas by a Postgres advisory lock or the mailbox row's lock on MySQL), so two related messages processed
	 * together never open two threads. A reply whose parent has no thread yet opens one for both.
	 */
	private async thread(row: InboxEmail, mailbox: InboxMailbox, message: ParsedInboundEmail): Promise<ID> {
		const key = mailbox.id as ID;
		const previous = this.threadLocks.get(key) ?? Promise.resolve();
		const run = previous
			.catch(() => undefined)
			.then(() => this.dataSource.transaction((manager) => this.assignThread(manager, row, mailbox, message)));
		this.threadLocks.set(key, run);
		try {
			return await run;
		} finally {
			if (this.threadLocks.get(key) === run) this.threadLocks.delete(key);
		}
	}

	private async assignThread(
		manager: EntityManager,
		row: InboxEmail,
		mailbox: InboxMailbox,
		message: ParsedInboundEmail
	): Promise<ID> {
		const type = String(this.dataSource.options.type);
		if (type === 'postgres') {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`gauzy-inbox:thread:${mailbox.id}`]);
		} else if (type === 'mysql' || type === 'mariadb') {
			await manager.query('SELECT `id` FROM `inbox_mailbox` WHERE `id` = ? FOR UPDATE', [mailbox.id]);
		}
		const emails = manager.getRepository(InboxEmail);
		const threads = manager.getRepository(InboxEmailThread);
		const participants = [message.from, ...message.to, ...message.cc]
			.map((entry) => normalizeAddress(entry?.address)?.address)
			.filter((address): address is string => !!address && address !== mailbox.address);
		const subject = normalizeSubject(message.subject);
		const at = message.receivedAt ?? new Date();

		// Already in a thread (a retry, or a reply put it there): keep it.
		const current = await emails.findOne({ where: { id: row.id as ID } });
		let thread: InboxEmailThread | null = current?.threadId
			? await threads.findOne({ where: { id: current.threadId } })
			: null;

		let parentWithoutThread: InboxEmail | null = null;
		const referenced = [...new Set([message.inReplyTo, ...message.references].filter((id): id is string => !!id))];
		if (!thread && referenced.length > 0) {
			const earlier = await emails.find({
				where: { mailboxId: mailbox.id as ID, messageId: In(referenced.slice(-50)) },
				order: { receivedAt: 'DESC' },
				take: 10
			});
			const threaded = earlier.find((email) => !!email.threadId && email.id !== row.id);
			if (threaded?.threadId) thread = await threads.findOne({ where: { id: threaded.threadId } });
			parentWithoutThread = thread ? null : (earlier.find((email) => email.id !== row.id) ?? null);
		}
		if (!thread && !parentWithoutThread && subject) {
			const candidates = await threads.find({
				where: {
					mailboxId: mailbox.id as ID,
					subjectNormalized: subject,
					lastMessageAt: MoreThanOrEqual(new Date(at.getTime() - THREAD_SUBJECT_WINDOW_MS)),
					deletedAt: IsNull()
				},
				order: { lastMessageAt: 'DESC' },
				take: 10
			});
			thread =
				candidates.find((candidate) =>
					parseList<string>(candidate.participants).some((address) => participants.includes(address))
				) ?? null;
		}
		if (!thread) {
			thread = await threads.save(
				threads.create({
					tenantId: row.tenantId,
					organizationId: row.organizationId ?? null,
					mailboxId: mailbox.id as ID,
					subjectNormalized: subject || null,
					participants: '[]',
					lastMessageAt: at,
					messageCount: 0
				} as InboxEmailThread)
			);
		}
		const threadId = thread.id as ID;
		await emails
			.createQueryBuilder()
			.update(InboxEmail)
			.set({ threadId })
			.where('id = :id AND threadId IS NULL', { id: row.id })
			.execute();
		if (parentWithoutThread) {
			await emails
				.createQueryBuilder()
				.update(InboxEmail)
				.set({ threadId })
				.where('id = :id AND threadId IS NULL', { id: parentWithoutThread.id })
				.execute();
		}

		// The counters from the thread's messages (never an increment: a repeat changes nothing).
		const messageCount = await emails.count({ where: { threadId } });
		const known = new Set([...parseList<string>(thread.participants), ...participants]);
		const last = thread.lastMessageAt ? new Date(thread.lastMessageAt) : null;
		await threads.update({ id: threadId }, {
			participants: JSON.stringify([...known].slice(0, 100)),
			messageCount,
			...(last && last.getTime() > at.getTime() ? {} : { lastMessageAt: at })
		} as QueryDeepPartialEntity<InboxEmailThread>);
		return threadId;
	}

	/** Creates (or, on a retry, updates) the `EMAIL` inbox item for the mailbox's recipients. */
	private async deliver(
		email: InboxEmail,
		mailbox: InboxMailbox,
		extra: { from: IInboundEmailAddress | null; attachments: number }
	): Promise<ID | null> {
		if (!this.inbox) {
			this.logger.warn('The Inbox is not loaded: the message is stored without an inbox item.');
			return null;
		}
		const recipients = await this.mailboxes.recipientsOf(mailbox);
		const from = extra.from?.name ? `${extra.from.name} <${extra.from.address}>` : extra.from?.address;
		const { item } = await this.inbox.upsertExternal({
			tenantId: email.tenantId as ID,
			organizationId: email.organizationId ?? null,
			kind: InboxItemKindEnum.EMAIL,
			source: InboxItemSourceEnum.EMAIL,
			externalSource: 'inbox_email',
			externalId: email.id as ID,
			title: (email.subject?.trim() || '(no subject)').slice(0, 300),
			body: (email.textBody ?? email.snippet ?? '').slice(0, MAX_ITEM_BODY) || null,
			bodyFormat: InboxItemBodyFormatEnum.PLAIN,
			metadata: {
				from: from ?? null,
				threadId: email.threadId ?? null,
				attachments: extra.attachments,
				spamVerdict: email.spamVerdict ?? null,
				mailboxAddress: mailbox.address
			},
			recipients: recipients.map((userId) => ({ userId }))
		});
		// The item's mailbox and message links (columns of the item that the writer leaves to its sources).
		await this.dataSource
			.getRepository(InboxItem)
			.update({ id: item.id as ID }, { mailboxId: mailbox.id as ID, emailId: email.id as ID });
		return (item.id as ID) ?? null;
	}

	/** The mailbox's last-message time and message count. */
	private async count(mailbox: InboxMailbox): Promise<void> {
		const total = await this.dataSource.getRepository(InboxEmail).count({
			where: {
				mailboxId: mailbox.id as ID,
				status: In([InboxEmailStatusEnum.PROCESSED, InboxEmailStatusEnum.QUARANTINED])
			}
		});
		await this.dataSource
			.getRepository(InboxMailbox)
			.update({ id: mailbox.id as ID }, { lastMessageAt: new Date(), messageCount: total });
	}
}
