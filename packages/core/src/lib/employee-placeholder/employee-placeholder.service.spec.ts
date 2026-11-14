import '../core/entities/internal';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { InvitationTypeEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import {
	Employee,
	Invite,
	Organization,
	OrganizationTeam,
	OrganizationTeamEmployee,
	Role,
	User
} from '../core/entities/internal';
import { InviteBulkCreateCommand } from '../invite/commands/invite.bulk.create.command';
import { EmployeePlaceholderService } from './employee-placeholder.service';

/**
 * Members without an account (ever-co/ever-gauzy#11913): created with a name and an optional email that never becomes
 * a login, once per email in an organization, in teams of that organization only; claimed through an employee
 * invitation of their organization; merged through the transfer service.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const OTHER_ORGANIZATION = 'organization-2';

type Row = Record<string, any>;

/** A value of a `where` read the way TypeORM would: `In`, the case-insensitive email `Raw`, or equality. */
function matchesValue(actual: unknown, expected: unknown): boolean {
	if (expected instanceof FindOperator) {
		if (expected.type === 'in') {
			return (expected.value as unknown[]).includes(actual);
		}
		if (expected.type === 'raw') {
			const wanted = (expected.objectLiteralParameters as { email: string }).email;
			return typeof actual === 'string' && actual.toLowerCase() === wanted;
		}
	}
	if (expected && typeof expected === 'object') {
		return Object.entries(expected).every(([key, value]) => matchesValue((actual as Row)?.[key], value));
	}
	return actual === expected;
}

/** An entity manager over in-memory tables, enough for what the service asks of it. */
function inMemoryManager(tables: Map<unknown, Row[]>) {
	let next = 1;
	const rowsOf = (entity: unknown) => {
		if (!tables.has(entity)) tables.set(entity, []);
		return tables.get(entity) as Row[];
	};
	const withRelations = (entity: unknown, row: Row) => {
		if (entity === Employee) {
			return { ...row, user: rowsOf(User).find((user) => user.id === row.userId) };
		}
		return row;
	};
	const manager: Row = {
		connection: { options: { type: 'sqlite' } },
		transaction: jest.fn(async (work: (inner: Row) => Promise<unknown>) => work(manager)),
		findOne: jest.fn(async (entity: unknown, options: Row) => {
			const rows = rowsOf(entity).map((row) => withRelations(entity, row));
			return rows.find((row) => matchesValue(row, options.where)) ?? null;
		}),
		find: jest.fn(async (entity: unknown, options: Row) =>
			rowsOf(entity).filter((row) => matchesValue(row, options.where))
		),
		create: jest.fn((_entity: unknown, values: Row) => ({ ...values })),
		save: jest.fn(async (entity: unknown, values: Row) => {
			const saved = { id: `${String((entity as { name?: string }).name).toLowerCase()}-${next++}`, ...values };
			rowsOf(entity).push(saved);
			return saved;
		}),
		update: jest.fn(async (entity: unknown, criteria: Row, values: Row) => {
			for (const row of rowsOf(entity).filter((it) => matchesValue(it, criteria))) {
				Object.assign(row, values);
			}
		})
	};
	return manager;
}

function build() {
	const tables = new Map<unknown, Row[]>([
		[
			Organization,
			[
				{ id: ORGANIZATION, tenantId: TENANT },
				{ id: OTHER_ORGANIZATION, tenantId: TENANT }
			]
		],
		[Role, [{ id: 'role-employee', name: RolesEnum.EMPLOYEE, tenantId: TENANT }]],
		[
			OrganizationTeam,
			[
				{ id: 'team-design', organizationId: ORGANIZATION, tenantId: TENANT },
				{ id: 'team-elsewhere', organizationId: OTHER_ORGANIZATION, tenantId: TENANT }
			]
		],
		[User, [{ id: 'user-marie', email: 'Marie@Ever.co', tenantId: TENANT }]],
		[
			Employee,
			[
				{
					id: 'employee-marie',
					userId: 'user-marie',
					organizationId: ORGANIZATION,
					tenantId: TENANT,
					isPlaceholder: false
				}
			]
		],
		[Invite, []]
	]);
	const manager = inMemoryManager(tables);
	const transferService = {
		preview: jest.fn(async () => ({ timeLogs: 3 })),
		transfer: jest.fn(async () => ({ timeLogs: 3, duration: 10800, timesheets: 1, taskAssignments: 2, teams: [] }))
	};
	const commandBus = {
		execute: jest.fn(async (command: InviteBulkCreateCommand) => {
			const invite = { id: 'invite-1', email: command.input.emailIds[0], code: 'C0DE' };
			tables.get(Invite)?.push(invite);
			return { items: [invite], total: 1, ignored: 0 };
		})
	};
	const service = new EmployeePlaceholderService({ manager } as never, transferService as never, commandBus as never);
	return { service, tables, transferService, commandBus };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('EmployeePlaceholderService.create', () => {
	it('creates a member without an account: a user with no email and no password, never tracking time', async () => {
		const { service, tables } = build();

		const employee = await service.create({
			organizationId: ORGANIZATION,
			firstName: ' Amina ',
			lastName: 'K.',
			email: ' Amina@Example.com ',
			teamIds: ['team-design']
		});

		expect(employee).toMatchObject({
			isPlaceholder: true,
			placeholderEmail: 'amina@example.com',
			isTrackingEnabled: false,
			organizationId: ORGANIZATION,
			user: { firstName: 'Amina', lastName: 'K.', email: null, hash: null, roleId: 'role-employee' }
		});
		expect(tables.get(OrganizationTeamEmployee)).toEqual([
			expect.objectContaining({ organizationTeamId: 'team-design', employeeId: employee.id })
		]);
		// The membership keeps the team's default: a claim or a merge moves it to a member who tracks time there.
		expect(tables.get(OrganizationTeamEmployee)?.[0].isTrackingEnabled).toBeUndefined();
	});

	it('creates one without an email', async () => {
		const { service } = build();

		const employee = await service.create({ organizationId: ORGANIZATION, firstName: 'Amina' });

		expect(employee).toMatchObject({ isPlaceholder: true, placeholderEmail: null, user: { lastName: null } });
	});

	it('refuses an email a member of the organization already has, with or without an account', async () => {
		const { service } = build();
		await service.create({ organizationId: ORGANIZATION, firstName: 'Amina', email: 'amina@example.com' });

		await expect(
			service.create({ organizationId: ORGANIZATION, firstName: 'Amina', email: 'AMINA@example.com' })
		).rejects.toBeInstanceOf(ConflictException);
		await expect(
			service.create({ organizationId: ORGANIZATION, firstName: 'Marie', email: 'marie@ever.co' })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('refuses a team of another organization, and a call that names no organization', async () => {
		const { service } = build();

		await expect(
			service.create({ organizationId: ORGANIZATION, firstName: 'Amina', teamIds: ['team-elsewhere'] })
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.create({ firstName: 'Amina' } as never)).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('EmployeePlaceholderService.createBulk', () => {
	it('creates each person once, and stands for the member who already has an email', async () => {
		const { service } = build();

		const { items } = await service.createBulk({
			organizationId: ORGANIZATION,
			members: [
				{ firstName: 'Amina', email: 'amina@example.com' },
				{ firstName: 'Marie', email: 'MARIE@ever.co' },
				{ firstName: 'Amina again', email: 'Amina@Example.com' },
				{ firstName: 'Jonas' }
			]
		});

		expect(items.map((item) => item.created)).toEqual([true, false, false, true]);
		expect(items[1].employee.id).toBe('employee-marie');
		expect(items[2].employee.id).toBe(items[0].employee.id);
	});

	it('creates nothing twice when the same rows are imported again', async () => {
		const { service } = build();
		const rows = { organizationId: ORGANIZATION, members: [{ firstName: 'Amina', email: 'amina@example.com' }] };

		const first = await service.createBulk(rows);
		const second = await service.createBulk(rows);

		expect(second.items[0]).toEqual({
			employee: expect.objectContaining({ id: first.items[0].employee.id }),
			created: false
		});
	});
});

describe('EmployeePlaceholderService.sendClaim', () => {
	it("sends an employee invitation of the placeholder's organization and marks it as handing the placeholder over", async () => {
		const { service, commandBus, tables } = build();
		const placeholder = await service.create({ organizationId: ORGANIZATION, firstName: 'Amina' });

		const invite = await service.sendClaim(
			placeholder.id,
			{
				organizationId: ORGANIZATION,
				email: 'Amina@Example.com',
				callbackUrl: 'https://app.ever.team/auth/accept-invite'
			},
			'en' as never
		);

		const command = commandBus.execute.mock.calls[0][0] as InviteBulkCreateCommand;
		expect(command).toBeInstanceOf(InviteBulkCreateCommand);
		expect(command.input).toMatchObject({
			emailIds: ['amina@example.com'],
			roleId: 'role-employee',
			inviteType: InvitationTypeEnum.EMPLOYEE,
			organizationId: ORGANIZATION,
			fullName: 'Amina',
			callbackUrl: 'https://app.ever.team/auth/accept-invite',
			queryParams: { email: 'email', code: 'code' }
		});
		expect(invite.placeholderEmployeeId).toBe(placeholder.id);
		expect(tables.get(Invite)?.[0]).toMatchObject({ id: 'invite-1', placeholderEmployeeId: placeholder.id });
	});

	it('refuses an email a member with an account already has: the placeholder is merged into theirs instead', async () => {
		const { service, commandBus } = build();
		const placeholder = await service.create({ organizationId: ORGANIZATION, firstName: 'Amina' });

		await expect(
			service.sendClaim(placeholder.id, { organizationId: ORGANIZATION, email: 'marie@ever.co' }, 'en' as never)
		).rejects.toBeInstanceOf(ConflictException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('reads a member with an account, or a placeholder of another organization, as nothing to claim', async () => {
		const { service } = build();
		const placeholder = await service.create({ organizationId: ORGANIZATION, firstName: 'Amina' });

		await expect(
			service.sendClaim('employee-marie', { organizationId: ORGANIZATION, email: 'x@example.com' }, 'en' as never)
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.sendClaim(
				placeholder.id,
				{ organizationId: OTHER_ORGANIZATION, email: 'x@example.com' },
				'en' as never
			)
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EmployeePlaceholderService.merge', () => {
	it('merges through the transfer service once the placeholder is found in the named organization', async () => {
		const { service, transferService } = build();
		const placeholder = await service.create({ organizationId: ORGANIZATION, firstName: 'Amina' });

		const result = await service.merge(placeholder.id, {
			organizationId: ORGANIZATION,
			targetEmployeeId: 'employee-marie'
		});

		expect(transferService.transfer).toHaveBeenCalledWith(placeholder.id, 'employee-marie', TENANT);
		expect(result).toMatchObject({ targetEmployeeId: 'employee-marie', timeLogs: 3, duration: 10800 });
	});

	it('neither previews nor merges a placeholder of another organization', async () => {
		const { service, transferService } = build();
		const placeholder = await service.create({ organizationId: ORGANIZATION, firstName: 'Amina' });
		const elsewhere = { organizationId: OTHER_ORGANIZATION, targetEmployeeId: 'employee-marie' };

		await expect(service.previewMerge(placeholder.id, elsewhere)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.merge(placeholder.id, elsewhere)).rejects.toBeInstanceOf(NotFoundException);
		expect(transferService.preview).not.toHaveBeenCalled();
		expect(transferService.transfer).not.toHaveBeenCalled();
	});
});
