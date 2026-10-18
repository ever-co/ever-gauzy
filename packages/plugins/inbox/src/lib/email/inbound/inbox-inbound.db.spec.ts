// cspell:ignore dmarc
/**
 * The inbound email pipeline (G-P4-2) end to end on a real database (better-sqlite3, the demo's engine): the provider
 * webhook through the built-in generic provider (the platform route and a provider account), the mailbox rules, the
 * idempotent store, the worker (sanitize, attachments, threading, spam verdict and quarantine, the EMAIL inbox item
 * through the real `InboxService`), and the message API (read access, raw, thread, reply through the transport seam,
 * release).
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application); the webhook signature
 * helpers are the real ones.
 */
const mockCaller: {
	tenantId: string | null;
	userId: string | null;
	organizationId: string | null;
	permissions: string[];
} = { tenantId: null, userId: null, organizationId: null, permissions: [] };

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class BaseEntity {}
	class UserOrganization {}
	class EmailSendService {}
	class EmailSendModule {}
	class RolePermissionModule {}
	class FileStorage {}
	return {
		...jest.requireActual('../../../../../../core/src/lib/webhook/webhook-signature'),
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		ExportRedacted: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		UserOrganization,
		EmailSendService,
		EmailSendModule,
		RolePermissionModule,
		FileStorage,
		EVER_REDIS_CLIENT: 'EVER_REDIS_CLIENT',
		describeEmailSendError: (error: unknown) => `message="${(error as Error)?.message ?? 'unknown error'}"`,
		getEmailTransportRegistry: () => ({ register: () => undefined, unregister: () => undefined }),
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentUserId: () => mockCaller.userId,
			currentOrganizationId: () => mockCaller.organizationId,
			hasPermission: (permission: string) => mockCaller.permissions.includes(permission)
		}
	};
});

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForbiddenException, NotFoundException, PayloadTooLargeException, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import {
	InboxEmailDirectionEnum,
	InboxEmailSpamVerdictEnum,
	InboxEmailStatusEnum,
	InboxItemKindEnum,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxMailboxMemberRoleEnum,
	InboxMailboxOwnerTypeEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UserOrganization } from '@gauzy/core';
import { signWebhookPayload } from '../../../../../../core/src/lib/webhook/webhook-signature';
import { INBOX_MIGRATIONS } from '../../database/inbox-migrations';
import { InboxItem } from '../../entities/inbox-item.entity';
import { InboxItemRecipient } from '../../entities/inbox-item-recipient.entity';
import { InboxService } from '../../inbox.service';
import { InboxSourceHandlerRegistry } from '../../inbox-source-handler.registry';
import { INBOX_EMAIL_MIGRATIONS } from '../database/inbox-email-migrations';
import { InboxEmailService } from '../emails/inbox-email.service';
import { InboxEmail } from '../entities/inbox-email.entity';
import { InboxEmailAttachment } from '../entities/inbox-email-attachment.entity';
import { InboxEmailThread } from '../entities/inbox-email-thread.entity';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { InboxMailboxMember } from '../entities/inbox-mailbox-member.entity';
import { InboxProviderAccount } from '../entities/inbox-provider-account.entity';
import { InboxEmailScopeService } from '../inbox-email-scope.service';
import { InboxMailboxAccessService } from '../mailboxes/inbox-mailbox-access.service';
import { InboxProviderAccountService } from '../provider-accounts/inbox-provider-account.service';
import { EmailProviderRegistry } from '../providers/email-provider.registry';
import { GENERIC_SIGNATURE_HEADER, GenericWebhookProvider } from '../providers/generic/generic-webhook.provider';
import { InboxSecretBox } from '../secrets/inbox-secret-box';
import { SAMPLE_MIME } from '../testing/sample-mime';
import { InboxEmailConfig, getInboxEmailConfig } from './inbox-email.config';
import { InboxEmailProcessor } from './inbox-email.processor';
import { IInboxStoredFile, InboxEmailStorage } from './inbox-email-storage';
import { InboxInboundService } from './inbox-inbound.service';
import { InboundReplayGuard } from './replay-guard.service';

jest.setTimeout(60_000);

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORG = randomUUID();
const ADA = randomUUID(); // owns the employee mailbox
const BOB = randomUUID(); // a member of the support mailbox
const EVE = randomUUID(); // a user of the tenant with no access
const ADA_EMPLOYEE = randomUUID();
const PLATFORM_SECRET = 'platform-signing-secret-of-enough-length';
const KEY = Buffer.alloc(32, 9).toString('base64');

const base = {
	id: { type: String, primary: true, generated: 'uuid' as const },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, nullable: true, default: true },
	isArchived: { type: Boolean, nullable: true, default: false },
	archivedAt: { type: Date, nullable: true },
	deletedAt: { type: Date, nullable: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true }
};
const s = (nullable = true) => ({ type: String, nullable });
const n = (nullable = true) => ({ type: Number, nullable });
const d = () => ({ type: Date, nullable: true });
const b = (fallback = false) => ({ type: Boolean, default: fallback });
const schema = (name: string, target: unknown, tableName: string, columns: Record<string, unknown>) =>
	new EntitySchema({
		name,
		target: target as never,
		tableName,
		columns: { ...base, ...(columns as object) } as never
	});

const SCHEMAS = [
	schema('InboxItem', InboxItem, 'inbox_item', {
		kind: s(false),
		source: s(false),
		status: s(false),
		title: s(false),
		body: s(),
		bodyFormat: s(false),
		options: s(),
		requireReason: b(),
		response: s(),
		priority: s(false),
		dueAt: d(),
		entity: s(),
		entityId: s(),
		taskId: s(),
		projectId: s(),
		agentEmployeeId: s(),
		mailboxId: s(),
		emailId: s(),
		externalSource: s(),
		externalId: s(),
		metadata: s()
	}),
	schema('InboxItemRecipient', InboxItemRecipient, 'inbox_item_recipient', {
		inboxItemId: s(false),
		userId: s(false),
		isRead: b(),
		readAt: d(),
		snoozedUntil: d(),
		deliveredAt: d()
	}),
	schema('InboxProviderAccount', InboxProviderAccount, 'inbox_provider_account', {
		providerId: s(false),
		name: s(false),
		scope: s(false),
		status: s(false),
		isDefaultOutbound: b(),
		config: s(),
		configEncrypted: s(),
		capabilities: s(),
		lastVerifiedAt: d(),
		lastError: s()
	}),
	schema('InboxMailbox', InboxMailbox, 'inbox_mailbox', {
		address: s(false),
		displayName: s(),
		kind: s(false),
		ownerType: s(false),
		ownerEmployeeId: s(),
		ownerTeamId: s(),
		purpose: s(false),
		providerAccountId: s(),
		inboundSecretHash: s(),
		senderAllowlist: s(),
		domain: s(),
		domainStatus: s(),
		domainVerificationToken: s(),
		isDefault: b(),
		autoProvisioned: b(),
		lastMessageAt: d(),
		messageCount: { type: Number, default: 0 },
		settings: s()
	}),
	schema('InboxMailboxMember', InboxMailboxMember, 'inbox_mailbox_member', {
		mailboxId: s(false),
		userId: s(false),
		role: s(false)
	}),
	schema('InboxEmailThread', InboxEmailThread, 'inbox_email_thread', {
		mailboxId: s(false),
		subjectNormalized: s(),
		participants: s(),
		lastMessageAt: d(),
		messageCount: { type: Number, default: 0 }
	}),
	schema('InboxEmail', InboxEmail, 'inbox_email', {
		mailboxId: s(false),
		threadId: s(),
		direction: s(false),
		messageId: s(false),
		inReplyTo: s(),
		referenceIds: s(),
		sender: s(),
		toAddresses: s(),
		ccAddresses: s(),
		bccAddresses: s(),
		replyToAddresses: s(),
		subject: s(),
		textBody: s(),
		htmlSanitized: s(),
		snippet: s(),
		headers: s(),
		spf: s(),
		dkim: s(),
		dmarc: s(),
		spamScore: n(),
		spamVerdict: s(),
		receivedAt: d(),
		sentAt: d(),
		sizeBytes: n(),
		rawStorageKey: s(),
		rawStorageProvider: s(),
		status: s(false),
		providerAccountId: s(),
		providerMessageId: s(),
		transport: s(),
		error: s(),
		attemptCount: { type: Number, default: 0 },
		inboxItemId: s()
	}),
	schema('InboxEmailAttachment', InboxEmailAttachment, 'inbox_email_attachment', {
		emailId: s(false),
		filename: s(false),
		contentType: s(),
		size: { type: Number, default: 0 },
		sha256: s(),
		storageKey: s(false),
		storageProvider: s(),
		contentId: s(),
		isInline: b(),
		savedDocumentId: s()
	}),
	new EntitySchema({
		name: 'UserOrganization',
		target: UserOrganization,
		tableName: 'user_organization',
		columns: {
			id: { type: String, primary: true, generated: 'uuid' as const },
			tenantId: s(),
			organizationId: s(),
			userId: s(),
			isActive: b(true),
			isArchived: b()
		}
	})
];

/** FileStorage in memory. */
class MemoryStorage extends InboxEmailStorage {
	readonly files = new Map<string, Buffer>();
	override async put(content: Buffer, key: string): Promise<IInboxStoredFile> {
		this.files.set(key, Buffer.from(content));
		return { key, provider: 'MEMORY' };
	}
	override async get(file: IInboxStoredFile): Promise<Buffer> {
		const content = this.files.get(file.key);
		if (!content) throw new Error('not stored');
		return content;
	}
}

/** The processor without its background task: the spec runs each message itself. */
class QueuedProcessor extends InboxEmailProcessor {
	readonly queued: string[] = [];
	override enqueue(emailId: string): void {
		this.queued.push(emailId);
	}
	async drain(): Promise<void> {
		while (this.queued.length) await this.process(this.queued.shift() as string);
	}
}

/** The settings with the platform secret. */
function config(overrides: Partial<InboxEmailConfig> = {}): InboxEmailConfig {
	return { ...getInboxEmailConfig({ GAUZY_INBOX_PLATFORM_SECRET: PLATFORM_SECRET }), ...overrides };
}

describe('Inbound email pipeline on SQLite', () => {
	let directory: string;
	let dataSource: DataSource;
	let registry: EmailProviderRegistry;
	let accounts: InboxProviderAccountService;
	let storage: MemoryStorage;
	let processor: QueuedProcessor;
	let inbound: InboxInboundService;
	let emails: InboxEmailService;
	let sent: Array<{ message: Record<string, unknown>; scope: Record<string, unknown> }>;
	let settings: InboxEmailConfig;
	let adaBox: InboxMailbox;
	let supportBox: InboxMailbox;

	const as = (userId: string | null, permissions: string[] = [PermissionsEnum.INBOX_VIEW]) => {
		mockCaller.userId = userId;
		mockCaller.tenantId = TENANT;
		mockCaller.organizationId = ORG;
		mockCaller.permissions = permissions;
	};

	// Every delivery signed at its own second (a relay's retry is signed anew); `at` pins one. The seconds go back
	// from now and are never handed out twice: `now - counter` repeated itself whenever a delivery took a second, and
	// a retry of the same body then carried the same signature and was refused as a replay.
	const usedSeconds = new Set<number>();
	const nextSecond = () => {
		let second = Math.floor(Date.now() / 1000);
		while (usedSeconds.has(second)) second--;
		usedSeconds.add(second);
		return second;
	};
	const signedRequest = (body: unknown, secret = PLATFORM_SECRET, at?: number) => {
		const raw = JSON.stringify(body);
		const timestamp = at ?? nextSecond();
		return {
			headers: { [GENERIC_SIGNATURE_HEADER]: signWebhookPayload(secret, raw, { timestamp }).header },
			body,
			rawBody: Buffer.from(raw),
			query: {},
			url: '/api/inbox/inbound/generic/platform'
		};
	};

	const deliver = (body: unknown) => inbound.receive('generic', 'platform', signedRequest(body));
	const mime = (raw: string, to: string[]) => ({ raw: Buffer.from(raw).toString('base64'), envelope: { to } });

	const mailbox = async (values: Partial<InboxMailbox>) => {
		const repository = dataSource.getRepository(InboxMailbox);
		return repository.save(
			repository.create({
				tenantId: TENANT,
				organizationId: ORG,
				kind: InboxMailboxKindEnum.PLATFORM,
				purpose: 'INBOX',
				isDefault: false,
				autoProvisioned: false,
				messageCount: 0,
				...values
			} as InboxMailbox)
		);
	};

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-inbound-'));
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: SCHEMAS,
			migrations: [...INBOX_MIGRATIONS, ...INBOX_EMAIL_MIGRATIONS],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		for (const sql of [
			`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)`,
			`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)`,
			`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "roleId" varchar)`,
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "userId" varchar)`,
			`CREATE TABLE "organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationTeamId" varchar, "employeeId" varchar, "deletedAt" datetime)`,
			`CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "deletedAt" datetime)`,
			`CREATE TABLE "role_permission" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "roleId" varchar, "permission" varchar, "enabled" boolean, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedAt" datetime)`,
			`CREATE TABLE "user_organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0))`
		]) {
			await dataSource.query(sql);
		}
		await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?), (?)`, [TENANT, OTHER_TENANT]);
		await dataSource.query(`INSERT INTO "organization" ("id", "tenantId") VALUES (?, ?)`, [ORG, TENANT]);
		await dataSource.query(`INSERT INTO "user" ("id", "tenantId") VALUES (?, ?), (?, ?), (?, ?)`, [
			ADA,
			TENANT,
			BOB,
			TENANT,
			EVE,
			TENANT
		]);
		await dataSource.query(`INSERT INTO "employee" ("id", "tenantId", "userId") VALUES (?, ?, ?)`, [
			ADA_EMPLOYEE,
			TENANT,
			ADA
		]);
		await dataSource.query(
			`INSERT INTO "user_organization" ("id", "tenantId", "organizationId", "userId") VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
			[randomUUID(), TENANT, ORG, ADA, randomUUID(), TENANT, ORG, BOB]
		);
		await dataSource.query(
			`INSERT INTO "user_organization" ("id", "tenantId", "organizationId", "userId") VALUES (?, ?, ?, ?)`,
			[randomUUID(), TENANT, ORG, EVE]
		);
		await dataSource.runMigrations({ transaction: 'each' });

		settings = config();
		registry = new EmailProviderRegistry();
		const replay = new InboundReplayGuard(null);
		new GenericWebhookProvider(registry).onModuleInit();
		accounts = new InboxProviderAccountService(
			dataSource,
			registry,
			new InboxEmailScopeService(dataSource),
			new InboxSecretBox({ ENCRYPTION_KEY: KEY })
		);
		const access = new InboxMailboxAccessService(dataSource);
		storage = new MemoryStorage();
		const inbox = new InboxService(dataSource, new InboxSourceHandlerRegistry());
		processor = new QueuedProcessor(dataSource, access, storage, inbox);
		jest.spyOn(processor as never, 'config').mockImplementation(() => settings as never);
		inbound = new InboxInboundService(dataSource, registry, accounts, access, storage, processor, replay);
		jest.spyOn(inbound as never, 'config').mockImplementation(() => settings as never);
		sent = [];
		const sender = {
			sendMessage: jest.fn(async (message: Record<string, unknown>, scope: Record<string, unknown>) => {
				sent.push({ message, scope });
				return { messageId: message['messageId'], accepted: [], rejected: [], transport: 'smtp' };
			})
		};
		emails = new InboxEmailService(dataSource, access, storage, processor, sender as never);

		adaBox = await mailbox({
			address: 'ada.ever@inbox.example.test',
			ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE,
			ownerEmployeeId: ADA_EMPLOYEE
		});
		supportBox = await mailbox({
			address: 'support.ever@inbox.example.test',
			ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION
		});
		await dataSource.getRepository(InboxMailboxMember).save(
			dataSource.getRepository(InboxMailboxMember).create({
				tenantId: TENANT,
				organizationId: ORG,
				mailboxId: supportBox.id as string,
				userId: BOB,
				role: InboxMailboxMemberRoleEnum.MANAGER
			} as InboxMailboxMember)
		);
		as(ADA);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	describe('webhook', () => {
		it('stores a message once per mailbox, and counts a retry as a duplicate', async () => {
			const body = mime(SAMPLE_MIME, ['support.ever@inbox.example.test', 'ada.ever+invoices@inbox.example.test']);
			expect(await deliver(body)).toEqual({ accepted: 2, duplicates: 0, dropped: 0 });
			// A provider's retry is a new signature over the same message.
			expect(await deliver(body)).toEqual({ accepted: 0, duplicates: 2, dropped: 0 });
			const rows = await dataSource.getRepository(InboxEmail).find();
			expect(rows.map((row) => row.status)).toEqual([
				InboxEmailStatusEnum.RECEIVED,
				InboxEmailStatusEnum.RECEIVED
			]);
			expect(new Set(rows.map((row) => row.rawStorageKey)).size).toBe(1);
			expect(rows.find((row) => row.mailboxId === adaBox.id)?.headers).toContain(
				'"x-gauzy-inbox-tag":"invoices"'
			);
		});

		it('keeps one stored file when deliveries of one message overlap', async () => {
			const body = mime(SAMPLE_MIME, ['support.ever@inbox.example.test']);
			const results = await Promise.all([deliver(body), deliver(body)]);
			expect(results.map((result) => result.accepted).sort()).toEqual([0, 1]);
			expect(storage.files.size).toBe(1);
			const row = await dataSource
				.getRepository(InboxEmail)
				.findOneByOrFail({ mailboxId: supportBox.id as string });
			expect(row.rawStorageKey).toBe(`inbox/${TENANT}/messages/${(row.rawStorageKey ?? '').slice(-52, -4)}.eml`);
			expect(row.rawStorageKey).toMatch(/\/messages\/[0-9a-f]{48}\.eml$/);
		});

		it('refuses an exact replay, and lets a retry through after a failed store', async () => {
			const body = mime(SAMPLE_MIME, ['support.ever@inbox.example.test']);
			const at = Math.floor(Date.now() / 1000);
			const put = jest.spyOn(storage, 'put').mockRejectedValueOnce(new Error('storage down'));
			await expect(
				inbound.receive('generic', 'platform', signedRequest(body, PLATFORM_SECRET, at))
			).rejects.toThrow('storage down');
			put.mockRestore();
			// The same signed request again: not a replay of a stored delivery, so it gets through.
			expect(await inbound.receive('generic', 'platform', signedRequest(body, PLATFORM_SECRET, at))).toEqual({
				accepted: 1,
				duplicates: 0,
				dropped: 0
			});
			await expect(
				inbound.receive('generic', 'platform', signedRequest(body, PLATFORM_SECRET, at))
			).rejects.toThrow(/already received/);
		});

		it('admits an allowlisted sender with a DMARC pass, and holds one without it in the quarantine', async () => {
			await dataSource.getRepository(InboxMailbox).update(
				{ id: supportBox.id as string },
				{
					senderAllowlist: JSON.stringify(['@acme.test'])
				}
			);
			// No verdict proves the From domain: stored, but held for a manager (never dropped unseen).
			const unproven = mime(SAMPLE_MIME, ['support.ever@inbox.example.test']);
			expect((await deliver({ ...unproven, authenticationResults: 'mx; dmarc=none' })).accepted).toBe(1);
			await processor.drain();
			const held = await dataSource.getRepository(InboxEmail).findOneByOrFail({ messageId: '<m-2@acme.test>' });
			expect([held.status, held.inboxItemId ?? null]).toEqual([InboxEmailStatusEnum.QUARANTINED, null]);
			expect(JSON.parse(held.headers as string)['x-gauzy-inbox-hold']).toBe('unverified-sender');

			const later = SAMPLE_MIME.replace('Message-ID: <m-2@acme.test>', 'Message-ID: <m-8@acme.test>');
			const proven = mime(later, ['support.ever@inbox.example.test']);
			expect(
				(await deliver({ ...proven, authenticationResults: 'mx; spf=pass; dkim=pass; dmarc=pass' })).accepted
			).toBe(1);
			await processor.drain();
			expect(
				(await dataSource.getRepository(InboxEmail).findOneByOrFail({ messageId: '<m-8@acme.test>' })).status
			).toBe(InboxEmailStatusEnum.PROCESSED);
		});

		it("keeps the provider's virus hold when the allowlist would hold the message too (review F107)", async () => {
			await dataSource
				.getRepository(InboxMailbox)
				.update({ id: supportBox.id as string }, { senderAllowlist: JSON.stringify(['@acme.test']) });
			// The provider's scan failed (SES: virusVerdict FAILED); the sender is allowlisted without a DMARC pass.
			const side = (
				registry.get('generic') as unknown as {
					inbound: { parse: (request: unknown) => Promise<Array<Record<string, unknown>>> };
				}
			).inbound;
			const parse = side.parse.bind(side);
			jest.spyOn(side, 'parse').mockImplementation(async (request) =>
				(await parse(request)).map((message) => ({ ...message, hold: 'virus' }))
			);
			const body = mime(SAMPLE_MIME, ['support.ever@inbox.example.test']);
			expect((await deliver({ ...body, authenticationResults: 'mx; dmarc=none' })).accepted).toBe(1);
			const held = await dataSource.getRepository(InboxEmail).findOneByOrFail({ messageId: '<m-2@acme.test>' });
			expect(JSON.parse(held.headers as string)['x-gauzy-inbox-hold']).toBe('virus');
		});

		it('stores a message whose address lists overflow a MySQL text column, cut to fit, instead of failing every retry (review F109)', async () => {
			jest.spyOn(inbound as never, 'textColumnBytes').mockReturnValue(2_000 as never);
			const crowd = Array.from({ length: 300 }, (_, n) => `member-${n}@lists.example.test`).join(', ');
			const raw = SAMPLE_MIME.replace('Cc: Bob <bob@acme.test>', `Cc: ${crowd}`);
			expect(await deliver(mime(raw, ['support.ever@inbox.example.test']))).toEqual({
				accepted: 1,
				duplicates: 0,
				dropped: 0
			});
			const row = await dataSource.getRepository(InboxEmail).findOneByOrFail({ messageId: '<m-2@acme.test>' });
			const cc = JSON.parse(row.ccAddresses as string) as Array<{ address: string }>;
			expect(Buffer.byteLength(row.ccAddresses as string)).toBeLessThanOrEqual(2_000);
			expect(cc.length).toBeGreaterThan(0);
			expect(cc.length).toBeLessThan(300);
			expect(cc[0].address).toBe('member-0@lists.example.test');
			expect(Buffer.byteLength(row.headers as string)).toBeLessThanOrEqual(2_000);
			// Postgres and SQLite keep everything (no budget): the next message of 300 is stored whole.
			(inbound as unknown as { textColumnBytes: jest.Mock }).textColumnBytes.mockReturnValue(null);
			const whole = raw.replace('Message-ID: <m-2@acme.test>', 'Message-ID: <m-3@acme.test>');
			await deliver(mime(whole, ['support.ever@inbox.example.test']));
			const full = await dataSource.getRepository(InboxEmail).findOneByOrFail({ messageId: '<m-3@acme.test>' });
			expect((JSON.parse(full.ccAddresses as string) as unknown[]).length).toBe(300);
		});

		it('drops unknown recipients, and mailboxes another account receives for', async () => {
			const created = await accounts.create({ providerId: 'generic', name: 'Relay' } as never);
			await mailbox({
				address: 'sales.ever@inbox.example.test',
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				providerAccountId: created.id as string
			});
			expect(
				await deliver(mime(SAMPLE_MIME, ['nobody@inbox.example.test', 'sales.ever@inbox.example.test']))
			).toEqual({ accepted: 0, duplicates: 0, dropped: 2 });

			// Through its own account it is accepted.
			const raw = JSON.stringify(mime(SAMPLE_MIME, ['sales.ever@inbox.example.test']));
			const secret = accounts.context(
				(await dataSource
					.getRepository(InboxProviderAccount)
					.findOneByOrFail({ id: created.id as string })) as never
			).config['signingSecret'] as string;
			expect(
				await inbound.receive('generic', created.id as string, {
					headers: { [GENERIC_SIGNATURE_HEADER]: signWebhookPayload(secret, raw).header },
					body: JSON.parse(raw),
					rawBody: Buffer.from(raw),
					query: {},
					url: ''
				})
			).toEqual({ accepted: 1, duplicates: 0, dropped: 0 });
		});

		it('keeps an unverified custom domain and a sender outside the allowlist out', async () => {
			await mailbox({
				address: 'billing@acme-own.test',
				kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				domain: 'acme-own.test',
				domainStatus: InboxMailboxDomainStatusEnum.PENDING
			});
			await dataSource.getRepository(InboxMailbox).update(
				{ id: supportBox.id as string },
				{
					senderAllowlist: JSON.stringify(['@partner.test'])
				}
			);
			expect(
				await deliver(mime(SAMPLE_MIME, ['billing@acme-own.test', 'support.ever@inbox.example.test']))
			).toEqual({ accepted: 0, duplicates: 0, dropped: 2 });
		});

		it('refuses unsigned and unknown routes, and stays shut without the platform secret', async () => {
			const body = mime(SAMPLE_MIME, ['support.ever@inbox.example.test']);
			await expect(
				inbound.receive('generic', 'platform', { ...signedRequest(body), headers: {} })
			).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(inbound.receive('generic', randomUUID(), signedRequest(body))).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(inbound.receive('resend', 'platform', signedRequest(body))).rejects.toBeInstanceOf(
				NotFoundException
			);
			settings = config({ platformSecret: null });
			await expect(deliver(body)).rejects.toBeInstanceOf(NotFoundException);
			expect(await dataSource.getRepository(InboxEmail).count()).toBe(0);
		});

		it('refuses a delivery over the size cap', async () => {
			settings = config({ maxMessageBytes: 100 });
			await expect(deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']))).rejects.toBeInstanceOf(
				PayloadTooLargeException
			);
			expect(await dataSource.getRepository(InboxEmail).count()).toBe(0);
		});
	});

	describe('worker', () => {
		it('sanitizes, stores the attachments, and delivers an EMAIL item to the mailbox recipients', async () => {
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			await processor.drain();
			const email = await dataSource
				.getRepository(InboxEmail)
				.findOneByOrFail({ mailboxId: supportBox.id as string });
			expect(email.status).toBe(InboxEmailStatusEnum.PROCESSED);
			expect(email.htmlSanitized).not.toMatch(/script|onclick/);
			expect(email.textBody?.trim()).toBe('Paid today.');
			expect(email.spamVerdict).toBe(InboxEmailSpamVerdictEnum.HAM);
			const attachments = await dataSource
				.getRepository(InboxEmailAttachment)
				.find({ where: { emailId: email.id as string } });
			expect(attachments.map((row) => row.filename).sort()).toEqual(['logo.png', 'receipt.pdf']);
			expect(attachments.every((row) => /^[0-9a-f]{64}$/.test(row.sha256 ?? ''))).toBe(true);

			const item = await dataSource.getRepository(InboxItem).findOneByOrFail({ id: email.inboxItemId as string });
			expect(item.kind).toBe(InboxItemKindEnum.EMAIL);
			expect([item.mailboxId, item.emailId]).toEqual([supportBox.id, email.id]);
			const recipients = await dataSource
				.getRepository(InboxItemRecipient)
				.find({ where: { inboxItemId: item.id as string } });
			expect(recipients.map((row) => row.userId)).toEqual([BOB]);
			const box = await dataSource.getRepository(InboxMailbox).findOneByOrFail({ id: supportBox.id as string });
			expect(box.messageCount).toBe(1);
		});

		it('delivers an employee mailbox to the employee’s user', async () => {
			await deliver(mime(SAMPLE_MIME, ['ada.ever@inbox.example.test']));
			await processor.drain();
			const email = await dataSource
				.getRepository(InboxEmail)
				.findOneByOrFail({ mailboxId: adaBox.id as string });
			const recipients = await dataSource
				.getRepository(InboxItemRecipient)
				.find({ where: { inboxItemId: email.inboxItemId as string } });
			expect(recipients.map((row) => row.userId)).toEqual([ADA]);
		});

		it('threads a reply by In-Reply-To, and a message by subject and participant', async () => {
			const first = SAMPLE_MIME.replace('Message-ID: <m-2@acme.test>', 'Message-ID: <m-1@acme.test>')
				.replace('In-Reply-To: <m-1@acme.test>\r\n', '')
				.replace('References: <m-0@acme.test> <m-1@acme.test>\r\n', '');
			await deliver(mime(first, ['support.ever@inbox.example.test']));
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			const later = first.replace('Message-ID: <m-1@acme.test>', 'Message-ID: <m-3@acme.test>');
			await deliver(mime(later, ['support.ever@inbox.example.test']));
			await processor.drain();
			const rows = await dataSource.getRepository(InboxEmail).find();
			expect(new Set(rows.map((row) => row.threadId)).size).toBe(1);
			const thread = await dataSource
				.getRepository(InboxEmailThread)
				.findOneByOrFail({ id: rows[0]?.threadId as string });
			expect(thread.messageCount).toBe(3);
			expect(thread.subjectNormalized).toBe('invoice 42');
		});

		it('quarantines spam without an item, and a manager releases it', async () => {
			await deliver({ ...mime(SAMPLE_MIME, ['support.ever@inbox.example.test']), spamScore: 50 });
			await processor.drain();
			const email = await dataSource
				.getRepository(InboxEmail)
				.findOneByOrFail({ mailboxId: supportBox.id as string });
			expect(email.status).toBe(InboxEmailStatusEnum.QUARANTINED);
			expect(email.inboxItemId ?? null).toBeNull();
			expect(await dataSource.getRepository(InboxItem).count()).toBe(0);
			// The thread view does not show it, nor does its count.
			const threadCount = async () =>
				(await dataSource.getRepository(InboxEmailThread).findOneByOrFail({ id: email.threadId as string }))
					.messageCount;
			expect(await threadCount()).toBe(0);

			// Not the business of a reader.
			as(EVE);
			await expect(emails.get(email.id as string)).rejects.toBeInstanceOf(NotFoundException);
			as(BOB);
			expect((await emails.quarantine(supportBox.id as string)).map((row) => row.id)).toEqual([email.id]);
			const released = await emails.release(email.id as string);
			expect(released.status).toBe(InboxEmailStatusEnum.PROCESSED);
			expect(released.inboxItemId).toBeTruthy();
			expect(await threadCount()).toBe(1);
		});

		it('puts a reply processed before its parent into one thread with it', async () => {
			const first = SAMPLE_MIME.replace('Message-ID: <m-2@acme.test>', 'Message-ID: <m-1@acme.test>')
				.replace('In-Reply-To: <m-1@acme.test>\r\n', '')
				.replace('References: <m-0@acme.test> <m-1@acme.test>\r\n', '')
				.replace('Subject: Re: Invoice 42', 'Subject: Something else');
			await deliver(mime(first, ['support.ever@inbox.example.test']));
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			// The reply first.
			processor.queued.reverse();
			await processor.drain();
			const rows = await dataSource.getRepository(InboxEmail).find();
			expect(rows.map((row) => row.status)).toEqual([
				InboxEmailStatusEnum.PROCESSED,
				InboxEmailStatusEnum.PROCESSED
			]);
			expect(new Set(rows.map((row) => row.threadId)).size).toBe(1);
			const thread = await dataSource
				.getRepository(InboxEmailThread)
				.findOneByOrFail({ id: rows[0]?.threadId as string });
			expect(thread.messageCount).toBe(2);
		});

		it('does not count a message twice when it is processed again', async () => {
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			await processor.drain();
			const email = await dataSource
				.getRepository(InboxEmail)
				.findOneByOrFail({ mailboxId: supportBox.id as string });
			await dataSource
				.getRepository(InboxEmail)
				.update({ id: email.id as string }, { status: InboxEmailStatusEnum.RECEIVED });
			expect(await processor.process(email.id as string)).toBe(InboxEmailStatusEnum.PROCESSED);
			const thread = await dataSource
				.getRepository(InboxEmailThread)
				.findOneByOrFail({ id: email.threadId as string });
			expect(thread.messageCount).toBe(1);
			expect(
				await dataSource.getRepository(InboxEmailAttachment).count({ where: { emailId: email.id as string } })
			).toBe(2);
			expect(storage.files.size).toBe(3);
		});

		it('leaves a message a later attempt took over alone', async () => {
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			const id = processor.queued[0] as string;
			const original = storage.get.bind(storage);
			// While this worker reads the raw message, another replica takes the message over (a newer attempt).
			jest.spyOn(storage, 'get').mockImplementationOnce(async (file) => {
				await dataSource.getRepository(InboxEmail).update({ id }, { attemptCount: 7 });
				return original(file);
			});
			expect(await processor.process(id)).toBeNull();
			const email = await dataSource.getRepository(InboxEmail).findOneByOrFail({ id });
			expect([email.status, email.attemptCount, email.inboxItemId ?? null]).toEqual([
				InboxEmailStatusEnum.PROCESSING,
				7,
				null
			]);
			// Nor did it write attachment rows: those go with the claimed state, in one transaction.
			expect(await dataSource.getRepository(InboxEmailAttachment).count({ where: { emailId: id } })).toBe(0);
		});

		it('retries a failure, then leaves the message FAILED with its error', async () => {
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			storage.files.clear();
			const id = processor.queued[0] as string;
			expect(await processor.process(id)).toBe(InboxEmailStatusEnum.RECEIVED);
			expect(await processor.process(id)).toBe(InboxEmailStatusEnum.RECEIVED);
			expect(await processor.process(id)).toBe(InboxEmailStatusEnum.FAILED);
			const email = await dataSource.getRepository(InboxEmail).findOneByOrFail({ id });
			expect([email.attemptCount, email.error]).toEqual([3, 'not stored']);
		});

		it('picks up a message whose hand-over was lost', async () => {
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			processor.queued.length = 0;
			expect(await processor.sweep(new Date(Date.now() + 5 * 60_000))).toBe(1);
			await processor.drain();
			expect(
				(await dataSource.getRepository(InboxEmail).findOneByOrFail({ mailboxId: supportBox.id as string }))
					.status
			).toBe(InboxEmailStatusEnum.PROCESSED);
		});
	});

	describe('message API', () => {
		beforeEach(async () => {
			await deliver(mime(SAMPLE_MIME, ['support.ever@inbox.example.test']));
			await processor.drain();
		});

		const stored = () =>
			dataSource.getRepository(InboxEmail).findOneByOrFail({ mailboxId: supportBox.id as string });

		it('lets the recipients read a message, nobody else', async () => {
			const email = await stored();
			as(BOB);
			const read = await emails.get(email.id as string);
			expect(read.from).toEqual({ address: 'ada@acme.test', name: 'Ada Lovelace' });
			expect(read.attachments).toHaveLength(2);
			as(EVE);
			await expect(emails.get(email.id as string)).rejects.toBeInstanceOf(NotFoundException);
			as(EVE, [PermissionsEnum.INBOX_VIEW, PermissionsEnum.INBOX_MAILBOX_READ_ALL]);
			expect((await emails.get(email.id as string)).id).toBe(email.id);
			mockCaller.tenantId = OTHER_TENANT;
			await expect(emails.get(email.id as string)).rejects.toBeInstanceOf(NotFoundException);
		});

		it('keeps the raw source to the mailbox managers', async () => {
			const email = await stored();
			as(BOB);
			const raw = await emails.raw(email.id as string);
			expect(raw.contentType).toBe('message/rfc822');
			expect(raw.content.toString()).toContain('X-Secret-Internal');
			await dataSource
				.getRepository(InboxMailboxMember)
				.update({ userId: BOB }, { role: InboxMailboxMemberRoleEnum.READER });
			await expect(emails.raw(email.id as string)).rejects.toThrow(/Managing this mailbox/);
		});

		it('lets an organization manager who is no member release a quarantined message', async () => {
			await dataSource
				.getRepository(InboxEmail)
				.update(
					{ mailboxId: supportBox.id as string },
					{ status: InboxEmailStatusEnum.QUARANTINED, inboxItemId: null as never }
				);
			const email = await stored();
			as(EVE, [PermissionsEnum.INBOX_VIEW, PermissionsEnum.INBOX_MAILBOX_MANAGE]);
			expect((await emails.quarantine(supportBox.id as string)).map((row) => row.id)).toEqual([email.id]);
			const released = await emails.release(email.id as string);
			expect(released.status).toBe(InboxEmailStatusEnum.PROCESSED);
			expect(released.attachments).toHaveLength(2);
		});

		it('shows a former member only the messages that were addressed to them', async () => {
			const email = await stored();
			await dataSource.getRepository(InboxMailboxMember).delete({ userId: BOB });
			// After the removal, the mailbox's mail goes to the organization's managers (none here).
			const later = SAMPLE_MIME.replace('Message-ID: <m-2@acme.test>', 'Message-ID: <m-9@acme.test>');
			await deliver(mime(later, ['support.ever@inbox.example.test']));
			await processor.drain();
			as(BOB);
			// Bob still reads the message he received, but not what arrived after he left.
			expect((await emails.thread(email.id as string)).map((row) => row.messageId)).toEqual(['<m-2@acme.test>']);
		});

		it('a long thread shows its newest messages, and the one asked for (review F110)', async () => {
			const email = await stored();
			const repository = dataSource.getRepository(InboxEmail);
			const start = new Date(email.receivedAt as Date).getTime();
			// 205 older alerts in the same thread, one a minute before the message read.
			const older: string[] = [];
			for (let n = 1; n <= 205; n++) {
				const at = new Date(start - n * 60_000);
				const row = await repository.save(
					repository.create({
						tenantId: TENANT,
						organizationId: ORG,
						mailboxId: supportBox.id as string,
						threadId: email.threadId,
						direction: InboxEmailDirectionEnum.IN,
						messageId: `<alert-${n}@acme.test>`,
						status: InboxEmailStatusEnum.PROCESSED,
						receivedAt: at,
						createdAt: at,
						attemptCount: 0
					} as InboxEmail)
				);
				older.push(row.id as string);
			}
			as(BOB);
			const thread = await emails.thread(email.id as string);
			expect(thread).toHaveLength(200);
			// Oldest first, ending with the newest message: the one read.
			expect(thread[thread.length - 1].id).toBe(email.id);
			expect(thread[0].messageId).toBe('<alert-199@acme.test>');
			// Asked for from the oldest alert: it is listed with the newest ones.
			const fromOldest = await emails.thread(older[older.length - 1]);
			expect(fromOldest).toHaveLength(201);
			expect(fromOldest[0].messageId).toBe('<alert-205@acme.test>');
			expect(fromOldest[fromOldest.length - 1].id).toBe(email.id);
		});

		it('lets a former member read what was addressed to them, but no longer send from the mailbox', async () => {
			const email = await stored();
			await dataSource.getRepository(InboxMailboxMember).delete({ userId: BOB });
			as(BOB);
			expect((await emails.get(email.id as string)).id).toBe(email.id);
			await expect(emails.reply(email.id as string, { text: 'Still here?' })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			await expect(emails.forward(email.id as string, { to: ['eve@elsewhere.test'] })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(sent).toHaveLength(0);
		});

		it('stops delivering to a member removed from the organization', async () => {
			const access = new InboxMailboxAccessService(dataSource);
			expect(await access.recipientsOf(supportBox)).toEqual([BOB]);
			await dataSource.query(`DELETE FROM "user_organization" WHERE "userId" = ?`, [BOB]);
			// The saved mailbox membership is kept, but grants nothing while Bob is not in the organization.
			expect(await access.recipientsOf(supportBox)).toEqual([]);
			expect(await access.canManage(supportBox, BOB)).toBe(false);
		});

		it('follows up on a sent message to its recipients again', async () => {
			const email = await stored();
			as(BOB);
			const first = await emails.reply(email.id as string, { text: 'Thanks!' });
			const followUp = await emails.reply(first.id as string, { text: 'Any news?' });
			expect(followUp.status).toBe(InboxEmailStatusEnum.SENT);
			expect(sent[1]?.message['to']).toEqual(['ada@acme.test']);
			expect(sent[1]?.message['inReplyTo']).toBe(first.messageId);
		});

		it('keeps the provider’s own id of a sent reply', async () => {
			const email = await stored();
			as(BOB);
			(emails as unknown as { sender: { sendMessage: jest.Mock } }).sender.sendMessage.mockImplementationOnce(
				async (message: Record<string, unknown>) => ({
					messageId: message['messageId'],
					accepted: ['ada@acme.test'],
					rejected: [],
					transport: 'provider:account',
					providerMessageId: 'pm-9'
				})
			);
			expect((await emails.reply(email.id as string, { text: 'Thanks!' })).providerMessageId).toBe('pm-9');
		});

		it('keeps the refused recipients of a partly accepted reply', async () => {
			const email = await stored();
			as(BOB);
			(emails as unknown as { sender: { sendMessage: jest.Mock } }).sender.sendMessage.mockResolvedValueOnce({
				messageId: null,
				accepted: ['ada@acme.test'],
				rejected: ['bob@acme.test'],
				transport: 'smtp'
			});
			const reply = await emails.reply(email.id as string, { text: 'Thanks!', replyAll: true });
			expect(reply.status).toBe(InboxEmailStatusEnum.SENT);
			expect(reply.error).toBe('Not accepted for: bob@acme.test');
		});

		it('replies from the mailbox address in the thread, through the transport seam', async () => {
			const email = await stored();
			as(BOB);
			const reply = await emails.reply(email.id as string, { text: 'Thanks!', replyAll: true });
			expect(reply.direction).toBe(InboxEmailDirectionEnum.OUT);
			expect(reply.status).toBe(InboxEmailStatusEnum.SENT);
			expect(reply.threadId).toBe(email.threadId);
			expect(sent).toHaveLength(1);
			const [{ message, scope }] = sent as [{ message: Record<string, unknown>; scope: Record<string, unknown> }];
			expect(message['from']).toBe('support.ever@inbox.example.test');
			expect(message['to']).toEqual(['ada@acme.test']);
			expect(message['cc']).toEqual(['bob@acme.test']);
			expect(message['subject']).toBe('Re: Invoice 42');
			expect(message['inReplyTo']).toBe('<m-2@acme.test>');
			expect(message['references']).toEqual(['<m-0@acme.test>', '<m-1@acme.test>', '<m-2@acme.test>']);
			expect(scope).toEqual({ tenantId: TENANT, organizationId: ORG, providerAccountId: null });
			expect((await emails.thread(email.id as string)).map((row) => row.direction)).toEqual([
				InboxEmailDirectionEnum.IN,
				InboxEmailDirectionEnum.OUT
			]);
		});

		it('forwards with the attachments', async () => {
			const email = await stored();
			as(BOB);
			await emails.forward(email.id as string, { to: ['partner@partner.test'], text: 'FYI' });
			const message = sent[0]?.message as Record<string, unknown>;
			expect(message['subject']).toBe('Fwd: Re: Invoice 42');
			expect((message['attachments'] as unknown[]).length).toBe(2);
			expect(String(message['text'])).toContain('---------- Forwarded message ----------');
			// The sent copy keeps its attachments (the stored files are shared).
			const copy = await dataSource
				.getRepository(InboxEmail)
				.findOneByOrFail({ direction: InboxEmailDirectionEnum.OUT });
			expect(
				await dataSource.getRepository(InboxEmailAttachment).count({ where: { emailId: copy.id as string } })
			).toBe(2);
		});
	});
});
