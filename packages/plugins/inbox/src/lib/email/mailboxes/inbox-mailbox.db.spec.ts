/**
 * Mailbox management (G-P4-1) on a real database (better-sqlite3): platform addresses allocated on
 * `GAUZY_INBOX_DOMAIN` (organization in the local part, numeric suffix on a collision), one namespace with the Docs
 * capture addresses, custom domains (reserved domains refused, an inbound account required, DNS TXT verification),
 * forwarding, members of shared mailboxes, provisioning (agents skipped, idempotent), the auto-provisioning setting and
 * the employee-created hook, the relay secret, and "my mailboxes".
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
	return {
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		ExportRedacted: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		UserOrganization,
		describeEmailSendError: (error: unknown) => `message="${(error as Error)?.message ?? 'unknown error'}"`,
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
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import {
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxMailboxMemberRoleEnum,
	InboxMailboxOwnerTypeEnum,
	InboxProviderAccountScopeEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UserOrganization } from '@gauzy/core';
import { INBOX_EMAIL_MIGRATIONS } from '../database/inbox-email-migrations';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { InboxMailboxMember } from '../entities/inbox-mailbox-member.entity';
import { InboxOrganizationSetting } from '../entities/inbox-organization-setting.entity';
import { InboxProviderAccount } from '../entities/inbox-provider-account.entity';
import { InboxEmailScopeService } from '../inbox-email-scope.service';
import { InboxProviderAccountService } from '../provider-accounts/inbox-provider-account.service';
import { EmailProviderRegistry } from '../providers/email-provider.registry';
import { InboxSecretBox } from '../secrets/inbox-secret-box';
import { InboxMailboxAccessService } from './inbox-mailbox-access.service';
import { InboxMailboxService } from './inbox-mailbox.service';

jest.setTimeout(60_000);

const TENANT = randomUUID();
const ORG = randomUUID();
const OTHER_ORG = randomUUID();
const ADA = randomUUID();
const BOB = randomUUID();
const OUTSIDER = randomUUID(); // a user of the tenant, not of the organization
const ADA_EMPLOYEE = randomUUID();
const BOB_EMPLOYEE = randomUUID();
const AGENT_EMPLOYEE = randomUUID();
const TEAM = randomUUID();
const OTHER_TEAM = randomUUID();
const DOMAIN = 'inbox.example.test';

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
const s = () => ({ type: String, nullable: true });
const SCHEMAS = [
	new EntitySchema({
		name: 'InboxMailbox',
		target: InboxMailbox,
		tableName: 'inbox_mailbox',
		columns: {
			...base,
			address: { type: String },
			displayName: s(),
			kind: { type: String },
			ownerType: { type: String },
			ownerEmployeeId: s(),
			ownerTeamId: s(),
			purpose: { type: String },
			providerAccountId: s(),
			inboundSecretHash: s(),
			senderAllowlist: s(),
			domain: s(),
			domainStatus: s(),
			domainVerificationToken: s(),
			isDefault: { type: Boolean, default: false },
			autoProvisioned: { type: Boolean, default: false },
			lastMessageAt: { type: Date, nullable: true },
			messageCount: { type: Number, default: 0 },
			settings: s()
		}
	}),
	new EntitySchema({
		name: 'InboxMailboxMember',
		target: InboxMailboxMember,
		tableName: 'inbox_mailbox_member',
		columns: { ...base, mailboxId: { type: String }, userId: { type: String }, role: { type: String } }
	}),
	new EntitySchema({
		name: 'InboxOrganizationSetting',
		target: InboxOrganizationSetting,
		tableName: 'inbox_organization_setting',
		columns: { ...base, autoProvisionEmployees: { type: Boolean, default: false } }
	}),
	new EntitySchema({
		name: 'InboxProviderAccount',
		target: InboxProviderAccount,
		tableName: 'inbox_provider_account',
		columns: {
			...base,
			providerId: { type: String },
			name: { type: String },
			scope: { type: String },
			status: { type: String },
			isDefaultOutbound: { type: Boolean, default: false },
			config: s(),
			configEncrypted: s(),
			capabilities: s(),
			lastVerifiedAt: { type: Date, nullable: true },
			lastError: s()
		}
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
			isActive: { type: Boolean, default: true },
			isArchived: { type: Boolean, default: false }
		}
	})
];

describe('Mailbox management on SQLite', () => {
	let directory: string;
	let dataSource: DataSource;
	let service: InboxMailboxService;
	let registry: EmailProviderRegistry;
	let accounts: InboxProviderAccountService;

	const as = (userId: string, permissions: string[] = [PermissionsEnum.INBOX_MAILBOX_MANAGE]) => {
		mockCaller.userId = userId;
		mockCaller.tenantId = TENANT;
		mockCaller.organizationId = ORG;
		mockCaller.permissions = permissions;
	};

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-mailbox-'));
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		process.env['GAUZY_INBOX_DOMAIN'] = DOMAIN;
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: SCHEMAS,
			migrations: INBOX_EMAIL_MIGRATIONS,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		for (const sql of [
			`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`,
			`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "profile_link" varchar)`,
			`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "roleId" varchar)`,
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "kind" varchar DEFAULT ('human'), "isActive" boolean DEFAULT (1), "deletedAt" datetime)`,
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "name" varchar)`,
			`CREATE TABLE "user_organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0))`,
			`CREATE TABLE "organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationTeamId" varchar, "employeeId" varchar, "deletedAt" datetime)`,
			`CREATE TABLE "role_permission" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "roleId" varchar, "permission" varchar, "enabled" boolean, "deletedAt" datetime)`,
			`CREATE TABLE "document_inbound_address" ("id" varchar PRIMARY KEY NOT NULL, "address" varchar)`
		]) {
			await dataSource.query(sql);
		}
		await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [TENANT]);
		await dataSource.query(
			`INSERT INTO "organization" ("id", "tenantId", "name", "profile_link") VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
			[ORG, TENANT, 'Acme Corp', 'acme', OTHER_ORG, TENANT, 'Other', 'other']
		);
		await dataSource.query(
			`INSERT INTO "user" ("id", "tenantId", "firstName", "lastName", "email") VALUES (?, ?, 'Ada', 'Lovelace', 'ada@acme.test'), (?, ?, 'Bob', 'Stone', 'bob@acme.test'), (?, ?, 'Out', 'Side', 'out@x.test')`,
			[ADA, TENANT, BOB, TENANT, OUTSIDER, TENANT]
		);
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId", "kind") VALUES (?, ?, ?, ?, 'human'), (?, ?, ?, ?, 'human'), (?, ?, ?, NULL, 'agent')`,
			[ADA_EMPLOYEE, TENANT, ORG, ADA, BOB_EMPLOYEE, TENANT, ORG, BOB, AGENT_EMPLOYEE, TENANT, ORG]
		);
		await dataSource.query(
			`INSERT INTO "organization_team" ("id", "tenantId", "organizationId", "name") VALUES (?, ?, ?, 'Design Team')`,
			[TEAM, TENANT, ORG]
		);
		await dataSource.query(
			`INSERT INTO "user_organization" ("id", "tenantId", "organizationId", "userId") VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
			[randomUUID(), TENANT, ORG, ADA, randomUUID(), TENANT, ORG, BOB]
		);
		await dataSource.runMigrations({ transaction: 'each' });
		registry = new EmailProviderRegistry();
		registry.register({
			id: 'relay',
			displayName: 'Relay',
			capabilities: { inbound: true, outbound: false, customDomains: true },
			configSchema: { type: 'object', properties: {} },
			inbound: { verify: async () => undefined, parse: async () => [] }
		});
		const scope = new InboxEmailScopeService(dataSource);
		accounts = new InboxProviderAccountService(
			dataSource,
			registry,
			scope,
			new InboxSecretBox({ ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') })
		);
		service = new InboxMailboxService(
			dataSource,
			scope,
			accounts,
			registry,
			new InboxMailboxAccessService(dataSource)
		);
		as(ADA);
	});

	afterEach(async () => {
		delete process.env['GAUZY_INBOX_DOMAIN'];
		await dataSource.destroy();
	});

	it('creates the table of settings, and a second run adds nothing', async () => {
		const count = async () =>
			(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'inbox_%'`))
				.length;
		const before = await count();
		for (const Migration of INBOX_EMAIL_MIGRATIONS) await new Migration().up(dataSource.createQueryRunner());
		expect(await count()).toBe(before);
	});

	describe('platform addresses', () => {
		it('allocates <name>.<orgSlug> on GAUZY_INBOX_DOMAIN, with a suffix on a collision', async () => {
			const ada = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE,
				ownerEmployeeId: ADA_EMPLOYEE
			});
			expect(ada.address).toBe(`ada.lovelace.acme@${DOMAIN}`);
			expect(ada.displayName).toBe('Ada Lovelace');
			const support = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				localPart: 'Support'
			});
			expect(support.address).toBe(`support.acme@${DOMAIN}`);
			const team = await service.create({ ownerType: InboxMailboxOwnerTypeEnum.TEAM, ownerTeamId: TEAM });
			expect(team.address).toBe(`design-team.acme@${DOMAIN}`);
			// A second employee mailbox for Ada gets a suffix; a chosen name that is taken is refused.
			const again = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE,
				ownerEmployeeId: ADA_EMPLOYEE
			});
			expect(again.address).toBe(`ada.lovelace2.acme@${DOMAIN}`);
			await expect(
				service.create({ ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION, localPart: 'support' })
			).rejects.toBeInstanceOf(ConflictException);
		});

		it('shares one namespace with the Docs capture addresses', async () => {
			await dataSource.query(`INSERT INTO "document_inbound_address" ("id", "address") VALUES (?, ?)`, [
				randomUUID(),
				`sales.acme@${DOMAIN}`
			]);
			await expect(
				service.create({ ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION, localPart: 'sales' })
			).rejects.toBeInstanceOf(ConflictException);
			expect(await service.isTaken(`Sales.ACME+x@${DOMAIN}`)).toBe(true);
		});

		it('refuses an owner of another organization, and an account for a platform address', async () => {
			await expect(
				service.create({ ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE, ownerEmployeeId: randomUUID() })
			).rejects.toBeInstanceOf(BadRequestException);
			await expect(
				service.create({ ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION, providerAccountId: randomUUID() })
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it('needs GAUZY_INBOX_DOMAIN', async () => {
			delete process.env['GAUZY_INBOX_DOMAIN'];
			await expect(service.create({ ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION })).rejects.toThrow(
				/GAUZY_INBOX_DOMAIN/
			);
		});

		it('keeps a forwarding source and shows forwarding instructions in my mailboxes', async () => {
			await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE,
				ownerEmployeeId: ADA_EMPLOYEE,
				kind: InboxMailboxKindEnum.FORWARDING,
				forwardFrom: 'Ada@Gmail.test'
			});
			as(ADA, [PermissionsEnum.INBOX_VIEW]);
			const [mine] = await service.mine();
			expect(mine?.kind).toBe(InboxMailboxKindEnum.FORWARDING);
			expect(mine?.settings).toEqual({ forwardFrom: 'ada@gmail.test' });
			expect(mine?.forwardingInstructions).toContain(mine?.address as string);
		});
	});

	describe('custom domains', () => {
		const account = async () =>
			(
				await accounts.create({
					providerId: 'relay',
					name: 'Relay',
					scope: InboxProviderAccountScopeEnum.ORGANIZATION
				} as never)
			).id as string;

		it('needs an inbound account and refuses the platform domain', async () => {
			await expect(
				service.create({
					ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
					kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
					localPart: 'billing',
					domain: 'acme.test'
				})
			).rejects.toThrow(/provider account/);
			const providerAccountId = await account();
			await expect(
				service.create({
					ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
					kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
					localPart: 'billing',
					domain: `x.${DOMAIN}`,
					providerAccountId
				})
			).rejects.toThrow(/reserved/);
		});

		it('is PENDING until the TXT record proves the domain, and FAILED when the proof goes away', async () => {
			const providerAccountId = await account();
			const created = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
				localPart: 'billing',
				domain: 'Acme.Test',
				providerAccountId
			});
			expect(created.address).toBe('billing@acme.test');
			expect(created.domainStatus).toBe(InboxMailboxDomainStatusEnum.PENDING);
			const record = created.verification as { recordName: string; recordValue: string };
			expect(record.recordName).toBe('_gauzy-inbox.acme.test');

			const lookup = jest.spyOn(service as never, 'resolveTxt');
			lookup.mockResolvedValueOnce(['unrelated'] as never);
			expect((await service.verify(created.id as string)).status).toBe(InboxMailboxDomainStatusEnum.PENDING);
			lookup.mockResolvedValueOnce([record.recordValue] as never);
			expect((await service.verify(created.id as string)).status).toBe(InboxMailboxDomainStatusEnum.VERIFIED);
			lookup.mockRejectedValueOnce(new Error('NXDOMAIN') as never);
			const lost = await service.verify(created.id as string);
			expect([lost.status, lost.message]).toEqual([InboxMailboxDomainStatusEnum.FAILED, 'NXDOMAIN']);
		});

		it("checks one mailbox without touching another's status on the same domain", async () => {
			const providerAccountId = await account();
			const first = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
				localPart: 'billing',
				domain: 'acme.test',
				providerAccountId
			});
			const lookup = jest.spyOn(service as never, 'resolveTxt');
			lookup.mockResolvedValueOnce([first.verification?.recordValue] as never);
			expect((await service.verify(first.id as string)).status).toBe(InboxMailboxDomainStatusEnum.VERIFIED);
			const second = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
				localPart: 'sales',
				domain: 'acme.test',
				providerAccountId
			});
			// The second mailbox's value is not published yet: it stays PENDING, the first stays VERIFIED.
			lookup.mockResolvedValueOnce([first.verification?.recordValue] as never);
			expect((await service.verify(second.id as string)).status).toBe(InboxMailboxDomainStatusEnum.PENDING);
			expect((await service.get(first.id as string)).domainStatus).toBe(InboxMailboxDomainStatusEnum.VERIFIED);
		});
	});

	describe('members, secrets, settings, provisioning', () => {
		it('sets the members of a shared mailbox, users of the organization only', async () => {
			const support = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				localPart: 'support'
			});
			expect(
				await service.setMembers(support.id as string, [
					{ userId: BOB, role: InboxMailboxMemberRoleEnum.MANAGER },
					{ userId: ADA }
				])
			).toEqual(
				expect.arrayContaining([
					{ userId: BOB, role: InboxMailboxMemberRoleEnum.MANAGER },
					{ userId: ADA, role: InboxMailboxMemberRoleEnum.READER }
				])
			);
			await expect(service.setMembers(support.id as string, [{ userId: OUTSIDER }])).rejects.toBeInstanceOf(
				BadRequestException
			);
			const employeeBox = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE,
				ownerEmployeeId: ADA_EMPLOYEE
			});
			await expect(service.setMembers(employeeBox.id as string, [{ userId: BOB }])).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it('rotates a relay secret: answered once, stored as a digest', async () => {
			const support = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				localPart: 'support'
			});
			const { inboundSecret } = await service.rotateSecret(support.id as string);
			const [row] = await dataSource.query(`SELECT "inboundSecretHash" FROM "inbox_mailbox" WHERE "id" = ?`, [
				support.id
			]);
			expect(row.inboundSecretHash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/);
			expect(row.inboundSecretHash).not.toContain(inboundSecret);
			expect(JSON.stringify(await service.get(support.id as string))).not.toContain('scrypt');
		});

		it('provisions every human employee and the default organization mailbox, once', async () => {
			const first = await service.provision({ employees: true, defaultOrganizationMailbox: true });
			expect(first.created.map((mailbox) => mailbox.address).sort()).toEqual(
				[`ada.lovelace.acme@${DOMAIN}`, `bob.stone.acme@${DOMAIN}`, `inbox.acme@${DOMAIN}`].sort()
			);
			expect(first.created.every((mailbox) => mailbox.autoProvisioned)).toBe(true);
			const again = await service.provision({ employees: true, defaultOrganizationMailbox: true });
			expect(again).toEqual({ created: [], existing: 1 });
			// The agent employee never gets one.
			expect(
				await dataSource.getRepository(InboxMailbox).count({ where: { ownerEmployeeId: AGENT_EMPLOYEE } })
			).toBe(0);
		});

		it('never provisions a mailbox twice when runs overlap', async () => {
			await service.updateSettings({ autoProvisionEmployees: true });
			const employee = { id: BOB_EMPLOYEE, tenantId: TENANT, organizationId: ORG, kind: 'human' };
			await Promise.all([
				service.provision({ employees: true, defaultOrganizationMailbox: true }),
				service.provision({ employees: true, defaultOrganizationMailbox: true }),
				service.onEmployeeCreated(employee)
			]);
			expect((await dataSource.getRepository(InboxMailbox).find()).map((row) => row.address).sort()).toEqual(
				[`ada.lovelace.acme@${DOMAIN}`, `bob.stone.acme@${DOMAIN}`, `inbox.acme@${DOMAIN}`].sort()
			);
		});

		it("keeps one team's default when another team's mailbox becomes its default", async () => {
			await dataSource.query(
				`INSERT INTO "organization_team" ("id", "tenantId", "organizationId", "name") VALUES (?, ?, ?, 'Sales Team')`,
				[OTHER_TEAM, TENANT, ORG]
			);
			const design = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.TEAM,
				ownerTeamId: TEAM,
				isDefault: true
			});
			const sales = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.TEAM,
				ownerTeamId: OTHER_TEAM,
				isDefault: true
			});
			expect((await service.get(design.id as string)).isDefault).toBe(true);
			expect((await service.get(sales.id as string)).isDefault).toBe(true);
		});

		it('lists the team mailbox a team member receives (no members: the team), not to others', async () => {
			const design = await service.create({ ownerType: InboxMailboxOwnerTypeEnum.TEAM, ownerTeamId: TEAM });
			await dataSource.query(
				`INSERT INTO "organization_team_employee" ("id", "tenantId", "organizationTeamId", "employeeId") VALUES (?, ?, ?, ?)`,
				[randomUUID(), TENANT, TEAM, BOB_EMPLOYEE]
			);
			as(BOB, [PermissionsEnum.INBOX_VIEW]);
			expect((await service.mine()).map((mailbox) => mailbox.id)).toEqual([design.id]);
			as(ADA, [PermissionsEnum.INBOX_VIEW]);
			expect(await service.mine()).toEqual([]);
		});

		it('provisions a new employee only where the organization opted in', async () => {
			const employee = { id: BOB_EMPLOYEE, tenantId: TENANT, organizationId: ORG, kind: 'human' };
			await service.onEmployeeCreated(employee);
			expect(await dataSource.getRepository(InboxMailbox).count()).toBe(0);
			expect((await service.updateSettings({ autoProvisionEmployees: true })).autoProvisionEmployees).toBe(true);
			await service.onEmployeeCreated(employee);
			await service.onEmployeeCreated({ ...employee, id: AGENT_EMPLOYEE, kind: 'agent' });
			expect((await dataSource.getRepository(InboxMailbox).find()).map((row) => row.address)).toEqual([
				`bob.stone.acme@${DOMAIN}`
			]);
		});

		it("never shows another organization's mailbox", async () => {
			const support = await service.create({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				localPart: 'support'
			});
			await expect(service.get(support.id as string, OTHER_ORG)).rejects.toThrow();
			mockCaller.organizationId = OTHER_ORG;
			await expect(service.get(support.id as string)).rejects.toThrow();
			mockCaller.organizationId = ORG;
			await expect(service.get(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});
