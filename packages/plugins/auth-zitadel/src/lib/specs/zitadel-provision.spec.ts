import { BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import {
	Employee,
	EmployeeCreateCommand,
	Organization,
	OrganizationCreateCommand,
	OrganizationTeam,
	OrganizationTeamCreateCommand,
	RoleAuthorizationService,
	TenantService,
	User
} from '@gauzy/core';
import { ZitadelAccount } from '../entities/zitadel-account.entity';
import { ZitadelOrganization } from '../entities/zitadel-organization.entity';
import { CreateUserPreLinkedInput, CreateUserPreLinkedResult } from '../ports/create-user-pre-linked.port';
import { ZitadelProvisionService } from '../services/zitadel-provision.service';

// A loose row: the stand-in tables hold whatever the provisioner writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Tables in memory, with the repository calls the provisioner makes. */
class FakeDatabase {
	readonly tables = new Map<string, Row[]>();

	table(entity: unknown): Row[] {
		const name = (entity as { name: string }).name;
		if (!this.tables.has(name)) this.tables.set(name, []);
		return this.tables.get(name) as Row[];
	}

	private matches(row: Row, where: Row): boolean {
		return Object.entries(where).every(([key, value]) => row[key] === value);
	}

	repository(entity: unknown, rows = this.table(entity)) {
		return {
			findOne: async ({ where }: { where: Row }) => rows.find((row) => this.matches(row, where)) ?? null,
			find: async ({ where }: { where: Row }) => rows.filter((row) => this.matches(row, where)),
			exists: async ({ where }: { where: Row }) => rows.some((row) => this.matches(row, where)),
			insert: async (values: Row) => {
				if (
					entity === ZitadelOrganization &&
					rows.some((row) => row['provisionKey'] === values['provisionKey'])
				) {
					throw new Error('UNIQUE constraint failed: zitadel_organization.provisionKey');
				}
				rows.push({ id: randomUUID(), ...values });
			}
		};
	}

	/** A data source whose transaction applies its writes only when the work resolves. */
	dataSource(queries: string[]) {
		return {
			getRepository: (entity: unknown) => this.repository(entity),
			transaction: async <T>(work: (manager: unknown) => Promise<T>): Promise<T> => {
				const staged = new Map<string, Row[]>();
				const tableOf = (entity: unknown) => {
					const name = (entity as { name: string }).name;
					if (!staged.has(name)) staged.set(name, [...this.table(entity)]);
					return staged.get(name) as Row[];
				};
				const manager = {
					getRepository: (entity: unknown) => this.repository(entity, tableOf(entity)),
					createQueryBuilder: () => ({
						insert: () => ({
							into: (entity: unknown) => ({
								values: (values: Row) => ({
									orIgnore: () => ({
										execute: async () => {
											tableOf(entity).push({ id: randomUUID(), ...values });
										}
									})
								})
							})
						})
					}),
					query: async (sql: string) => {
						queries.push(sql);
						return [];
					}
				};
				const result = await work(manager);
				for (const [name, rows] of staged) this.tables.set(name, rows);
				return result;
			}
		};
	}
}

const INPUT: CreateUserPreLinkedInput = {
	issuer: 'https://auth.ever.test',
	subject: '300000000000000001',
	email: 'owner@acme.example',
	firstName: 'Ada',
	lastName: 'Owner',
	tenant: { name: 'Acme' },
	organization: { name: 'Acme', officialName: 'Acme GmbH', country: 'DE', website: 'https://acme.example' },
	everOrgId: '01K9A0000000000000000000RG',
	everTenantId: '01K9A0000000000000000000RG',
	handle: 'acme',
	options: { createEmployee: true, createTeam: true },
	idempotencyKey: '01K9A0000000000000000000JB:2'
};

/**
 * The workspace creation of the Ever ID sign-in plugin, with Gauzy's own paths stood in: the owner
 * through Gauzy's register path (marked verified), the tenant through `onboardTenant`, organization,
 * employee and team through their commands, then the organization and Ever ID links in one
 * transaction with the caller's rows. A retry resumes from the ids it is given and never makes a
 * second user or tenant; a finished key answers its ids.
 */
describe('ZitadelProvisionService (createUserPreLinked)', () => {
	let db: FakeDatabase;
	let queries: string[];
	let registered: Array<{ input: unknown }>;
	let onboarded: Array<{ name: string; userId: string }>;
	let commands: unknown[];
	let failOrganizationOnce: boolean;
	let service: ZitadelProvisionService;

	beforeEach(() => {
		db = new FakeDatabase();
		queries = [];
		registered = [];
		onboarded = [];
		commands = [];
		failOrganizationOnce = false;
		const users = db.table(User);
		const gauzyAuth = {
			register: async (input: { user: { email: string } }) => {
				registered.push({ input });
				const user = { id: randomUUID(), email: input.user.email, tenantId: null, emailVerifiedAt: null };
				users.push(user);
				return { id: user.id };
			}
		};
		const accounts = {
			markEmailVerified: async (userId: string) => {
				const user = users.find((row) => row['id'] === userId);
				if (user) user['emailVerifiedAt'] = new Date();
			}
		};
		const tenantService = {
			onboardTenant: async (entity: { name: string }, user: Row) => {
				onboarded.push({ name: entity.name, userId: user['id'] });
				const row = users.find((candidate) => candidate['id'] === user['id']) as Row;
				row['tenantId'] = randomUUID();
				row['roleId'] = 'super-admin-role';
				return { id: row['tenantId'] };
			}
		};
		const commandBus = {
			execute: async (command: unknown) => {
				commands.push(command);
				if (command instanceof OrganizationCreateCommand) {
					if (failOrganizationOnce) {
						failOrganizationOnce = false;
						throw new Error('connection timeout');
					}
					const tenantId = users[0]['tenantId'];
					const organization = { id: randomUUID(), tenantId, createdAt: new Date(), ...command.input };
					db.table(Organization).push(organization);
					return organization;
				}
				if (command instanceof EmployeeCreateCommand) {
					db.table(Employee).push({
						id: randomUUID(),
						userId: command.input.userId,
						organizationId: command.input.organizationId
					});
					return undefined;
				}
				if (command instanceof OrganizationTeamCreateCommand) {
					const team = { id: randomUUID(), createdAt: new Date(), ...command.input };
					db.table(OrganizationTeam).push(team);
					return team;
				}
				throw new Error('unexpected command');
			}
		};
		const services = new Map<unknown, unknown>([
			[TenantService, tenantService],
			[CommandBus, commandBus],
			[RoleAuthorizationService, { attachAuthorizationState: async (user: unknown) => user }]
		]);
		const moduleRef = { get: (type: unknown) => services.get(type) };
		service = new ZitadelProvisionService(
			db.dataSource(queries) as never,
			moduleRef as never,
			accounts as never,
			gauzyAuth as never
		);
	});

	it('creates the owner, tenant, organization, employee and team, then writes both links with the caller rows in one transaction', async () => {
		const finalized: CreateUserPreLinkedResult[] = [];
		const checkpoints: Array<Partial<CreateUserPreLinkedResult>> = [];
		const result = await service.createUserPreLinked(INPUT, {
			checkpoint: async (ids) => {
				checkpoints.push(ids);
			},
			finalize: async (tx, ids) => {
				finalized.push(ids);
				await tx.query('INSERT INTO "integration_tenant" VALUES (1)');
			}
		});

		expect(registered).toEqual([
			{ input: { user: { email: 'owner@acme.example', firstName: 'Ada', lastName: 'Owner' } } }
		]);
		const [user] = db.table(User);
		expect(user['emailVerifiedAt']).toBeInstanceOf(Date);
		expect(onboarded).toEqual([{ name: 'Acme', userId: user['id'] }]);

		const organization = commands.find((c) => c instanceof OrganizationCreateCommand) as OrganizationCreateCommand;
		expect(organization.input).toEqual({
			name: 'Acme',
			officialName: 'Acme GmbH',
			currency: 'USD',
			website: 'https://acme.example/',
			contact: { country: 'DE' },
			isActive: true
		});
		expect(organization.input).not.toHaveProperty('profile_link');
		const team = commands.find((c) => c instanceof OrganizationTeamCreateCommand) as OrganizationTeamCreateCommand;
		expect(team.input).toMatchObject({
			name: 'Acme',
			memberIds: [result.employeeId],
			managerIds: [result.employeeId]
		});

		expect(result).toEqual({
			userId: user['id'],
			tenantId: user['tenantId'],
			organizationId: expect.any(String),
			employeeId: expect.any(String),
			teamId: expect.any(String)
		});
		expect(db.table(ZitadelOrganization)).toEqual([
			expect.objectContaining({
				tenantId: result.tenantId,
				organizationId: result.organizationId,
				everOrgId: INPUT.everOrgId,
				handle: 'acme',
				provisionKey: INPUT.idempotencyKey,
				linkedByUserId: result.userId,
				ssoEnforced: false
			})
		]);
		expect(db.table(ZitadelAccount)).toEqual([
			expect.objectContaining({
				issuer: INPUT.issuer,
				subject: INPUT.subject,
				userId: result.userId,
				tenantId: result.tenantId,
				emailAtLink: 'owner@acme.example',
				linkMethod: 'provisioned'
			})
		]);
		expect(finalized).toEqual([result]);
		expect(queries).toEqual(['INSERT INTO "integration_tenant" VALUES (1)']);
		expect(checkpoints.at(-1)).toEqual(result);
	});

	it('no team unless asked; no employee unless asked', async () => {
		const result = await service.createUserPreLinked({
			...INPUT,
			options: { createEmployee: false, createTeam: false }
		});
		expect(result.employeeId).toBeUndefined();
		expect(result.teamId).toBeUndefined();
		expect(
			commands.filter((c) => c instanceof EmployeeCreateCommand || c instanceof OrganizationTeamCreateCommand)
		).toEqual([]);
	});

	it('a finished key answers its ids and creates nothing', async () => {
		const first = await service.createUserPreLinked(INPUT);
		const again = await service.createUserPreLinked(INPUT);
		expect(again).toEqual({ ...first, existing: true });
		expect(registered).toHaveLength(1);
		expect(onboarded).toHaveLength(1);
		expect(await service.findProvisioned(INPUT.idempotencyKey)).toEqual({ ...first, existing: true });
	});

	it('a retry resumes from the kept ids: the same owner and tenant, never a second one', async () => {
		failOrganizationOnce = true;
		let kept: Partial<CreateUserPreLinkedResult> = {};
		await expect(
			service.createUserPreLinked(INPUT, { checkpoint: async (ids) => void (kept = ids) })
		).rejects.toThrow('connection timeout');
		expect(kept).toEqual({ userId: expect.any(String), tenantId: expect.any(String) });
		// Nobody can sign in yet: no Ever ID link.
		expect(db.table(ZitadelAccount)).toEqual([]);

		const result = await service.createUserPreLinked(INPUT, { resume: kept });
		expect(result).toMatchObject({ userId: kept.userId, tenantId: kept.tenantId });
		expect(registered).toHaveLength(1);
		expect(onboarded).toHaveLength(1);
		expect(db.table(ZitadelAccount)).toHaveLength(1);
	});

	it('when the caller rows fail, neither link is written', async () => {
		await expect(
			service.createUserPreLinked(INPUT, {
				finalize: async () => {
					throw new Error('caller rows failed');
				}
			})
		).rejects.toThrow('caller rows failed');
		expect(db.table(ZitadelOrganization)).toEqual([]);
		expect(db.table(ZitadelAccount)).toEqual([]);
	});

	it('an Ever organization linked by another key is reported', async () => {
		await service.createUserPreLinked(INPUT);
		expect(await service.isLinkedElsewhere(INPUT.everOrgId, INPUT.idempotencyKey)).toBe(false);
		expect(await service.isLinkedElsewhere(INPUT.everOrgId, 'another-key')).toBe(true);
		expect(await service.isLinkedElsewhere('01K9A0000000000000000000ZZ', 'another-key')).toBe(false);
	});

	it('refuses an incomplete request before anything is created', async () => {
		await expect(service.createUserPreLinked({ ...INPUT, email: '' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.createUserPreLinked({ ...INPUT, idempotencyKey: '' })).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(registered).toEqual([]);
	});
});
