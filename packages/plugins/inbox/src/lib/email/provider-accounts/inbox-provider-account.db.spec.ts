/**
 * Email provider accounts (G-P4-2) on a real database (better-sqlite3, the demo's engine): the migration (up, up
 * again, down), the configuration split against the provider's form (secrets sealed, never answered, kept when
 * left out, a generated secret shown once), the organization / tenant scoping, the one default outbound account
 * per scope, and the transport resolver's order (named account → organization default → tenant default → none).
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as the inbox suite does.
 */
const mockCaller: {
	tenantId: string | null;
	userId: string | null;
	organizationId: string | null;
	permissions: string[];
} = { tenantId: null, userId: null, organizationId: null, permissions: [] };

const mockTransportRegistry = { register: jest.fn(), unregister: jest.fn() };

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class BaseEntity {}
	class UserOrganization {}
	return {
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		ExportRedacted: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		UserOrganization,
		describeEmailSendError: (error: unknown) => `message="${(error as Error)?.message ?? 'unknown error'}"`,
		getEmailTransportRegistry: () => mockTransportRegistry,
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
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
	ServiceUnavailableException
} from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import {
	IEmailProviderConfigSchema,
	InboxProviderAccountScopeEnum,
	InboxProviderAccountStatusEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UserOrganization } from '@gauzy/core';
import { INBOX_EMAIL_MIGRATIONS } from '../database/inbox-email-migrations';
import { InboxProviderAccount } from '../entities/inbox-provider-account.entity';
import { InboxEmailScopeService } from '../inbox-email-scope.service';
import { EmailProviderRegistry } from '../providers/email-provider.registry';
import { IEmailProviderPlugin, IProviderAccountContext } from '../providers/email-provider.types';
import { InboxSecretBox } from '../secrets/inbox-secret-box';
import { InboxEmailTransportResolver } from '../transport/inbox-email-transport.resolver';
import { InboxProviderAccountService } from './inbox-provider-account.service';

jest.setTimeout(60_000);

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORG = randomUUID();
const OTHER_ORG = randomUUID();
const ADA = randomUUID();
const EVE = randomUUID(); // a user of the other tenant
const KEY = Buffer.alloc(32, 7).toString('base64');

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

const accountSchema = new EntitySchema({
	name: 'InboxProviderAccount',
	target: InboxProviderAccount,
	tableName: 'inbox_provider_account',
	columns: {
		...base,
		providerId: { type: String },
		name: { type: String },
		scope: { type: String, default: 'ORGANIZATION' },
		status: { type: String, default: 'ACTIVE' },
		isDefaultOutbound: { type: Boolean, default: false },
		config: { type: String, nullable: true },
		configEncrypted: { type: String, nullable: true },
		capabilities: { type: String, nullable: true },
		lastVerifiedAt: { type: Date, nullable: true },
		lastError: { type: String, nullable: true }
	}
});

const membershipSchema = new EntitySchema({
	name: 'UserOrganization',
	target: UserOrganization,
	tableName: 'user_organization',
	columns: {
		id: { type: String, primary: true, generated: 'uuid' as const },
		tenantId: { type: String, nullable: true },
		organizationId: { type: String, nullable: true },
		userId: { type: String, nullable: true },
		isActive: { type: Boolean, default: true },
		isArchived: { type: Boolean, default: false }
	}
});

const schema: IEmailProviderConfigSchema = {
	type: 'object',
	properties: {
		apiKey: { type: 'string', title: 'API key', writeOnly: true },
		webhookPassword: { type: 'string', generated: true },
		fromAddress: { type: 'string', format: 'email' },
		region: { type: 'string', enum: ['us', 'eu'], default: 'us' }
	},
	required: ['apiKey']
};

/** A provider plugin double that records the transports it builds and the checks it runs. */
function fakeProvider(id = 'fake', outbound = true): IEmailProviderPlugin & { built: IProviderAccountContext[] } {
	const built: IProviderAccountContext[] = [];
	return {
		id,
		displayName: `Fake ${id}`,
		capabilities: { inbound: false, outbound, customDomains: false },
		configSchema: schema,
		built,
		...(outbound
			? {
					createTransport: (account: IProviderAccountContext) => {
						built.push(account);
						return { name: `${id}-transport`, version: '1', send: jest.fn(), accountId: account.id };
					}
				}
			: {}),
		verifyAccount: async (account: IProviderAccountContext) =>
			account.config['apiKey'] === 'good-key' ? { ok: true } : { ok: false, message: 'The API key was refused.' }
	};
}

describe('Email provider accounts on SQLite', () => {
	let directory: string;
	let dataSource: DataSource;
	let registry: EmailProviderRegistry;
	let service: InboxProviderAccountService;
	let resolver: InboxEmailTransportResolver;
	let provider: ReturnType<typeof fakeProvider>;

	const as = (userId: string, tenantId = TENANT, organizationId: string | null = ORG, permissions: string[] = []) => {
		mockCaller.userId = userId;
		mockCaller.tenantId = tenantId;
		mockCaller.organizationId = organizationId;
		mockCaller.permissions = [PermissionsEnum.INBOX_MAILBOX_MANAGE, ...permissions];
	};

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-email-'));
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: [accountSchema, membershipSchema],
			migrations: INBOX_EMAIL_MIGRATIONS,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)`);
		await dataSource.query(
			`CREATE TABLE "user_organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0))`
		);
		await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?), (?)`, [TENANT, OTHER_TENANT]);
		await dataSource.query(`INSERT INTO "organization" ("id", "tenantId") VALUES (?, ?), (?, ?)`, [
			ORG,
			TENANT,
			OTHER_ORG,
			TENANT
		]);
		await dataSource.query(
			`INSERT INTO "user_organization" ("id", "tenantId", "organizationId", "userId") VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
			[randomUUID(), TENANT, ORG, ADA, randomUUID(), TENANT, OTHER_ORG, ADA, randomUUID(), OTHER_TENANT, ORG, EVE]
		);
		await dataSource.runMigrations({ transaction: 'each' });

		registry = new EmailProviderRegistry();
		provider = fakeProvider();
		registry.register(provider);
		service = new InboxProviderAccountService(
			dataSource,
			registry,
			new InboxEmailScopeService(dataSource),
			new InboxSecretBox({ ENCRYPTION_KEY: KEY })
		);
		resolver = new InboxEmailTransportResolver(service, registry);
		as(ADA);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	const create = (overrides: Record<string, unknown> = {}) =>
		service.create({
			providerId: 'fake',
			name: 'Fake (support)',
			config: { apiKey: 'good-key', fromAddress: 'support@acme.test' },
			...overrides
		} as never);

	describe('migration', () => {
		it('creates the table, a second run adds nothing, and down drops it', async () => {
			const tables = async () =>
				(
					await dataSource.query(
						`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'inbox_provider_account'`
					)
				).length;
			expect(await tables()).toBe(1);
			for (const Migration of INBOX_EMAIL_MIGRATIONS) {
				await new Migration().up(dataSource.createQueryRunner());
			}
			expect(await tables()).toBe(1);
			for (const Migration of [...INBOX_EMAIL_MIGRATIONS].reverse()) {
				await new Migration().down(dataSource.createQueryRunner());
			}
			expect(await tables()).toBe(0);
		});
	});

	describe('configuration and secrets', () => {
		it('seals the secrets, answers none of them, and shows a generated one once', async () => {
			const created = await create();
			expect(created.config).toEqual({ fromAddress: 'support@acme.test', region: 'us' });
			expect(created.secretsSet.sort()).toEqual(['apiKey', 'webhookPassword']);
			expect(Object.keys(created.oneTimeSecrets)).toEqual(['webhookPassword']);
			expect(JSON.stringify(created)).not.toContain('good-key');

			const [row] = await dataSource.query(`SELECT "config", "configEncrypted" FROM "inbox_provider_account"`);
			expect(row.config).not.toContain('good-key');
			expect(row.configEncrypted).toMatch(/^ib1:k:/);
			expect(row.configEncrypted).not.toContain('good-key');

			const read = await service.get(created.id as string);
			expect(JSON.stringify(read)).not.toContain('good-key');
			expect(JSON.stringify(read)).not.toContain(created.oneTimeSecrets['webhookPassword']);
			expect((read as unknown as Record<string, unknown>)['oneTimeSecrets']).toBeUndefined();
		});

		it('keeps a secret that an update leaves out or sends empty, and clears it on null', async () => {
			const created = await create();
			await service.update(created.id as string, { config: { apiKey: '', region: 'eu' } });
			let context = service.context(
				(await dataSource
					.getRepository(InboxProviderAccount)
					.findOneByOrFail({ id: created.id as string })) as never
			);
			expect(context.config['apiKey']).toBe('good-key');
			expect(context.config['region']).toBe('eu');

			await service.update(created.id as string, { config: { apiKey: 'rotated-key' } });
			context = service.context(
				(await dataSource
					.getRepository(InboxProviderAccount)
					.findOneByOrFail({ id: created.id as string })) as never
			);
			expect(context.config['apiKey']).toBe('rotated-key');

			// Required: it cannot be cleared.
			await expect(service.update(created.id as string, { config: { apiKey: null } })).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it('rotates a generated secret cleared with null, and answers the new one once', async () => {
			const created = await create();
			const first = created.oneTimeSecrets['webhookPassword'];
			const rotated = await service.update(created.id as string, { config: { webhookPassword: null } });
			expect(rotated.oneTimeSecrets['webhookPassword']).toMatch(/^[A-Za-z0-9_-]{43}$/);
			expect(rotated.oneTimeSecrets['webhookPassword']).not.toBe(first);
			const unchanged = await service.update(created.id as string, { name: 'Renamed' });
			expect(unchanged.oneTimeSecrets).toEqual({});
		});

		it("refuses a field the provider's form does not have, and a value it does not allow", async () => {
			await expect(create({ config: { apiKey: 'k', smtpHost: 'x' } })).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(create({ config: { apiKey: 'k', region: 'mars' } })).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(create({ config: { apiKey: 'k', fromAddress: 'not-an-address' } })).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(create({ config: { fromAddress: 'a@b.test' } })).rejects.toBeInstanceOf(BadRequestException);
			await expect(create({ providerId: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
		});

		it('refuses to store credentials without a usable key', async () => {
			const keyless = new InboxProviderAccountService(
				dataSource,
				registry,
				new InboxEmailScopeService(dataSource),
				new InboxSecretBox({})
			);
			await expect(
				keyless.create({ providerId: 'fake', name: 'x', config: { apiKey: 'k' } } as never)
			).rejects.toBeInstanceOf(ServiceUnavailableException);
		});
	});

	describe('scope', () => {
		it("lists the organization's accounts and the tenant's, never another organization's", async () => {
			const mine = await create();
			const other = await create({ organizationId: OTHER_ORG, name: 'Other org' });
			as(ADA, TENANT, ORG, [PermissionsEnum.ALL_ORG_EDIT]);
			const tenantWide = await create({ scope: InboxProviderAccountScopeEnum.TENANT, name: 'Tenant' });

			const ids = (await service.list(ORG)).map((account) => account.id);
			expect(ids).toEqual(expect.arrayContaining([mine.id, tenantWide.id]));
			expect(ids).not.toContain(other.id);
			await expect(service.get(other.id as string, ORG)).rejects.toBeInstanceOf(NotFoundException);
		});

		it('keeps a tenant-wide account to holders of ALL_ORG_EDIT', async () => {
			await expect(create({ scope: InboxProviderAccountScopeEnum.TENANT })).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it("never shows one tenant's account to another tenant, nor to a non-member", async () => {
			const mine = await create();
			as(EVE, OTHER_TENANT, ORG);
			await expect(service.get(mine.id as string, ORG)).rejects.toBeInstanceOf(NotFoundException);
			as(ADA, TENANT, randomUUID());
			await expect(service.list()).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe('connection test', () => {
		it('never turns a disabled account active again', async () => {
			const created = await create();
			await service.update(created.id as string, { status: InboxProviderAccountStatusEnum.DISABLED });
			expect((await service.verify(created.id as string)).ok).toBe(true);
			expect((await service.get(created.id as string)).status).toBe(InboxProviderAccountStatusEnum.DISABLED);
		});

		it('records the result on the account', async () => {
			const created = await create({ config: { apiKey: 'bad-key' } });
			const failed = await service.verify(created.id as string);
			expect(failed).toMatchObject({ ok: false, message: 'The API key was refused.' });
			expect((await service.get(created.id as string)).status).toBe(InboxProviderAccountStatusEnum.ERROR);

			await service.update(created.id as string, { config: { apiKey: 'good-key' } });
			expect((await service.verify(created.id as string)).ok).toBe(true);
			const read = await service.get(created.id as string);
			expect(read.status).toBe(InboxProviderAccountStatusEnum.ACTIVE);
			expect(read.lastError).toBeNull();
		});
	});

	describe('outbound', () => {
		it('keeps one default outbound account per scope', async () => {
			const first = await create({ isDefaultOutbound: true });
			const second = await create({ name: 'Second', isDefaultOutbound: true });
			expect((await service.get(first.id as string)).isDefaultOutbound).toBe(false);
			expect((await service.get(second.id as string)).isDefaultOutbound).toBe(true);
		});

		it('refuses a second default outbound account in one scope at the database too', async () => {
			const first = await create({ isDefaultOutbound: true });
			const second = await create({ name: 'Second' });
			await expect(
				dataSource.query(`UPDATE "inbox_provider_account" SET "isDefaultOutbound" = 1 WHERE "id" = ?`, [
					second.id
				])
			).rejects.toThrow(/UNIQUE/);
			expect((await service.get(first.id as string)).isDefaultOutbound).toBe(true);
		});

		it("falls back to the tenant's default when the organization's cannot build a transport", async () => {
			const broken = fakeProvider('broken');
			broken.createTransport = () => {
				throw new Error('no transport');
			};
			registry.register(broken);
			as(ADA, TENANT, ORG, [PermissionsEnum.ALL_ORG_EDIT]);
			const tenantDefault = await create({
				scope: InboxProviderAccountScopeEnum.TENANT,
				name: 'Tenant default',
				isDefaultOutbound: true
			});
			await create({ providerId: 'broken', name: 'Broken org default', isDefaultOutbound: true });
			expect((await resolver.resolve({ tenantId: TENANT, organizationId: ORG }))?.source).toBe(
				`fake:${tenantDefault.id}`
			);
		});

		it('refuses a provider that does not send as the outbound account', async () => {
			registry.register(fakeProvider('inbound-only', false));
			await expect(create({ providerId: 'inbound-only', isDefaultOutbound: true })).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it('resolves the named account, then the organization default, then the tenant default, then none', async () => {
			expect(await resolver.resolve({ tenantId: TENANT, organizationId: ORG })).toBeNull();

			as(ADA, TENANT, ORG, [PermissionsEnum.ALL_ORG_EDIT]);
			const tenantDefault = await create({
				scope: InboxProviderAccountScopeEnum.TENANT,
				name: 'Tenant default',
				isDefaultOutbound: true,
				config: { apiKey: 'good-key', fromAddress: 'noreply@acme.test' }
			});
			expect((await resolver.resolve({ tenantId: TENANT, organizationId: ORG }))?.source).toBe(
				`fake:${tenantDefault.id}`
			);

			const orgDefault = await create({ name: 'Org default', isDefaultOutbound: true });
			const resolved = await resolver.resolve({ tenantId: TENANT, organizationId: ORG });
			expect(resolved?.source).toBe(`fake:${orgDefault.id}`);
			expect(resolved?.fromAddress).toBe('support@acme.test');
			// The decrypted secrets reach the provider, nowhere else.
			expect(provider.built[provider.built.length - 1]?.config['apiKey']).toBe('good-key');

			const named = await create({ name: 'Mailbox account' });
			expect(
				(
					await resolver.resolve({
						tenantId: TENANT,
						organizationId: ORG,
						providerAccountId: named.id as string
					})
				)?.source
			).toBe(`fake:${named.id}`);

			// Another tenant's request never gets this tenant's account, named or not.
			expect(
				await resolver.resolve({
					tenantId: OTHER_TENANT,
					organizationId: ORG,
					providerAccountId: named.id as string
				})
			).toBeNull();

			// A disabled account is skipped; the next step answers.
			await service.update(orgDefault.id as string, { status: InboxProviderAccountStatusEnum.DISABLED });
			expect((await resolver.resolve({ tenantId: TENANT, organizationId: ORG }))?.source).toBe(
				`fake:${tenantDefault.id}`
			);
		});

		it('registers with the core transport registry at module init, and leaves at destroy', () => {
			resolver.onModuleInit();
			expect(mockTransportRegistry.register).toHaveBeenCalledWith(resolver);
			resolver.onModuleDestroy();
			expect(mockTransportRegistry.unregister).toHaveBeenCalledWith(resolver.id);
		});
	});

	describe('removal', () => {
		it('removes an account softly: gone from the lists, disabled, no longer the default, never resolved', async () => {
			const account = await create({ isDefaultOutbound: true });
			expect(await service.remove(account.id as string)).toEqual({ id: account.id, deleted: true });

			expect(await service.list()).toEqual([]);
			await expect(service.get(account.id as string)).rejects.toBeInstanceOf(NotFoundException);
			const [row] = await dataSource.query(
				`SELECT "deletedAt", "status", "isDefaultOutbound" FROM "inbox_provider_account" WHERE "id" = ?`,
				[account.id]
			);
			// The row is kept (no-removal rule), marked deleted.
			expect(row.deletedAt).not.toBeNull();
			expect([row.status, !!row.isDefaultOutbound]).toEqual([InboxProviderAccountStatusEnum.DISABLED, false]);
			expect(await service.findUsable(account.id as string, TENANT)).toBeNull();
			expect(await resolver.resolve({ tenantId: TENANT, organizationId: ORG })).toBeNull();
			// A second removal finds nothing.
			await expect(service.remove(account.id as string)).rejects.toBeInstanceOf(NotFoundException);
		});

		it('is refused while a mailbox receives through the account', async () => {
			const account = await create();
			await dataSource.query(
				`INSERT INTO "inbox_mailbox" ("id", "tenantId", "organizationId", "address", "kind", "ownerType", "providerAccountId") VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[randomUUID(), TENANT, ORG, 'billing@acme.test', 'CUSTOM_DOMAIN', 'ORGANIZATION', account.id]
			);
			await expect(service.remove(account.id as string)).rejects.toBeInstanceOf(ConflictException);
			expect((await service.get(account.id as string)).status).toBe(InboxProviderAccountStatusEnum.ACTIVE);

			// Once that mailbox is gone, the account can go.
			await dataSource.query(`UPDATE "inbox_mailbox" SET "deletedAt" = datetime('now')`);
			expect((await service.remove(account.id as string)).deleted).toBe(true);
		});

		it('needs ALL_ORG_EDIT for a tenant-wide account, and another organization cannot reach one of this', async () => {
			as(ADA, TENANT, ORG, [PermissionsEnum.ALL_ORG_EDIT]);
			const tenantWide = await create({ scope: InboxProviderAccountScopeEnum.TENANT });
			const own = await create({ name: 'Own' });
			as(ADA);
			await expect(service.remove(tenantWide.id as string)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(service.remove(own.id as string, OTHER_ORG)).rejects.toBeInstanceOf(NotFoundException);
			expect((await service.list()).map((entry) => entry.id).sort()).toEqual([tenantWide.id, own.id].sort());
		});
	});
});
