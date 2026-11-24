import '../core/entities/internal';

import { EmployeeNotificationTypeEnum, IUser } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { CrudService } from '../core/crud/crud.service';
import {
	lockConnectionSlots,
	releaseLockConnectionSlot,
	takeLockConnectionSlot
} from '../database/lock-connection-slots';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationService } from './employee-notification.service';

const ORGANIZATION_B = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0b00';
const BEN = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00b1';
const CLEO = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00c1';
const LINK = 'https://boards.example/#room=r00m,secret-key';

/** Lets every pending callback run, as a database round trip would. */
const roundTrip = () => new Promise((resolve) => setImmediate(resolve));

/**
 * A Board notification from the Boards app (ever-co/ever-teams#5022, review on ever-co/ever-gauzy#12007):
 * - it is filed in the organization `boardNotificationsOf` checked the caller works in, even when that is not the
 *   organization of their token (their last one): the organization boundary of the CRUD base would refuse it;
 * - two identical requests that overlap file each colleague's notification once: the unread check and the insert run
 *   one request after the other, in this process and, through a database lock, across API processes.
 */
describe('EmployeeNotificationService — notifyAboutBoard, organization and overlapping requests', () => {
	const fixture = createTenantFixture({
		user: { employeeId: 'employee-ana', firstName: 'Ana', lastName: 'Lima' } as IUser
	});
	const employees = [
		{ id: 'employee-ana', userId: fixture.user.id, organizationId: fixture.organizationId, isActive: true },
		{ id: 'employee-ana-b', userId: fixture.user.id, organizationId: ORGANIZATION_B, isActive: true },
		{ id: BEN, organizationId: ORGANIZATION_B, isActive: true },
		{ id: CLEO, organizationId: ORGANIZATION_B, isActive: true }
	];
	const input = { receiverEmployeeIds: [BEN, CLEO], roomId: 'r00m', boardName: 'Sprint plan', link: LINK };

	let restore: () => void;
	let cls: Map<string, unknown>;

	function serviceOn(connection: Record<string, unknown> = {}): EmployeeNotificationService {
		const repository = {
			find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
				where['userId']
					? employees.filter((employee) => employee.userId === where['userId'])
					: employees.filter(
							(employee) => !employee.userId && employee.organizationId === where['organizationId']
						)
			)
		};
		return new EmployeeNotificationService(
			{
				metadata: {
					tableName: 'employee_notification',
					hasColumnWithPropertyPath: (column: string) => column !== 'employeeId'
				},
				manager: { connection: { getRepository: jest.fn(() => repository), ...connection } }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any
		);
	}

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		// The request-scoped store the organization boundary's escapes count their open blocks in
		cls = new Map();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(RequestContext as any).clsService = {
			get: (key: string) => cls.get(key),
			set: (key: string, value: unknown) => cls.set(key, value)
		};
	});

	afterEach(() => {
		restore?.();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (RequestContext as any).clsService;
		jest.restoreAllMocks();
	});

	it('files it through the real create path in another organization the caller works in, not their last one', async () => {
		const service = serviceOn();
		jest.spyOn(service.logger, 'warn').mockImplementation(() => undefined);
		jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);
		const find = jest.spyOn(service, 'find').mockResolvedValue([]);
		// The persistence edge only: the tenant scoping and the organization boundary of the CRUD base run for real
		const inserted = jest
			.spyOn(CrudService.prototype, 'create')
			.mockImplementation(async (entity) => ({ id: `notification-${Math.random()}`, ...entity }) as never);

		await expect(
			service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, {
				...input,
				organizationId: ORGANIZATION_B
			})
		).resolves.toEqual({ notified: 2 });

		expect(inserted.mock.calls.map(([entity]) => entity)).toEqual([
			expect.objectContaining({
				receiverEmployeeId: BEN,
				organizationId: ORGANIZATION_B,
				tenantId: fixture.tenantId
			}),
			expect.objectContaining({
				receiverEmployeeId: CLEO,
				organizationId: ORGANIZATION_B,
				tenantId: fixture.tenantId
			})
		]);
		// The unread check looks in that organization too
		expect(find).toHaveBeenCalledWith({
			where: expect.objectContaining({ organizationId: ORGANIZATION_B, sentByEmployeeId: 'employee-ana-b' })
		});
	});

	it('files each colleague once when two identical requests overlap', async () => {
		const service = serviceOn();
		const stored: Array<Record<string, unknown>> = [];
		jest.spyOn(service, 'find').mockImplementation(async () => {
			await roundTrip();
			return stored.filter((row) => !row['isRead']) as never;
		});
		const create = jest.spyOn(service, 'create').mockImplementation(async (notification) => {
			await roundTrip();
			const row = { ...notification, isRead: false };
			stored.push(row);
			return row as never;
		});
		const request = { ...input, organizationId: ORGANIZATION_B };

		await Promise.all([
			service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, request),
			service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, request)
		]);

		expect(create.mock.calls.map(([notification]) => notification.receiverEmployeeId)).toEqual([BEN, CLEO]);
	});

	it('holds a transaction-scoped advisory lock on PostgreSQL while it checks and files, named without the link', async () => {
		const steps: string[] = [];
		const runner = {
			connect: jest.fn(async () => steps.push('connect')),
			startTransaction: jest.fn(async () => steps.push('begin')),
			query: jest.fn<Promise<unknown>, [string, unknown[]?]>(async (sql) => steps.push(sql)),
			commitTransaction: jest.fn(async () => steps.push('commit')),
			rollbackTransaction: jest.fn(async () => steps.push('rollback')),
			release: jest.fn(async () => steps.push('release'))
		};
		const service = serviceOn({ options: { type: 'postgres' }, createQueryRunner: () => runner });
		jest.spyOn(service, 'find').mockImplementation(async () => {
			steps.push('check');
			return [];
		});
		jest.spyOn(service, 'create').mockImplementation(async (notification) => {
			steps.push(`file ${notification.receiverEmployeeId}`);
			return notification as never;
		});

		await service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, {
			...input,
			organizationId: ORGANIZATION_B
		});

		expect(steps).toEqual([
			'connect',
			'begin',
			"SET LOCAL lock_timeout = '5s'",
			'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
			'check',
			`file ${BEN}`,
			`file ${CLEO}`,
			'commit',
			'release'
		]);
		const lockCall = runner.query.mock.calls.find(([sql]) => String(sql).includes('pg_advisory_xact_lock'));
		const lockName = String((lockCall?.[1] as unknown[] | undefined)?.[0]);
		expect(lockName).toMatch(/^board-notification:[0-9a-f]{32}$/);
		expect(lockName).not.toContain('secret-key');
	});

	it('holds a named lock on MySQL while it checks and files, and still files when the lock stays taken', async () => {
		const steps: string[] = [];
		let acquired = 1;
		const runner = {
			connect: jest.fn(async () => steps.push('connect')),
			query: jest.fn<Promise<unknown>, [string, unknown[]?]>(async (sql) => {
				steps.push(sql);
				return String(sql).startsWith('SELECT GET_LOCK') ? [{ acquired }] : [];
			}),
			release: jest.fn(async () => steps.push('release'))
		};
		const service = serviceOn({ options: { type: 'mysql' }, createQueryRunner: () => runner });
		jest.spyOn(service, 'find').mockImplementation(async () => {
			steps.push('check');
			return [];
		});
		const create = jest.spyOn(service, 'create').mockImplementation(async (notification) => {
			steps.push(`file ${notification.receiverEmployeeId}`);
			return notification as never;
		});
		const request = { ...input, organizationId: ORGANIZATION_B };

		await service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, request);

		expect(steps).toEqual([
			'connect',
			'SELECT GET_LOCK(?, 5) AS `acquired`',
			'check',
			`file ${BEN}`,
			`file ${CLEO}`,
			'SELECT RELEASE_LOCK(?)',
			'release'
		]);

		// Another process kept the lock past the wait: the notifications are filed all the same (best effort)
		steps.length = 0;
		create.mockClear();
		acquired = 0;
		await service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, request);
		expect(create).toHaveBeenCalledTimes(2);
		expect(steps).not.toContain('SELECT RELEASE_LOCK(?)');
	});

	it('holds at most one pooled connection for these locks at a time, even for requests about different Boards', async () => {
		let held = 0;
		let mostHeld = 0;
		const runnerOf = () => ({
			connect: jest.fn(async () => {
				held += 1;
				mostHeld = Math.max(mostHeld, held);
			}),
			startTransaction: jest.fn(async () => undefined),
			query: jest.fn<Promise<unknown>, [string, unknown[]?]>(async () => roundTrip()),
			commitTransaction: jest.fn(async () => undefined),
			rollbackTransaction: jest.fn(async () => undefined),
			release: jest.fn(async () => {
				held -= 1;
			})
		});
		const service = serviceOn({ options: { type: 'postgres', poolSize: 2 }, createQueryRunner: runnerOf });
		jest.spyOn(service, 'find').mockImplementation(async () => {
			await roundTrip();
			return [];
		});
		const create = jest.spyOn(service, 'create').mockImplementation(async (notification) => {
			await roundTrip();
			return notification as never;
		});

		await Promise.all(
			['r00m', 'other-room', 'third-room'].map((roomId) =>
				service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, {
					...input,
					roomId,
					organizationId: ORGANIZATION_B
				})
			)
		);

		// The work of a request needs a connection of the pool besides the one holding its lock: never more than one
		// is set aside for the locks, so the work always finds one
		expect(mostHeld).toBe(1);
		expect(create).toHaveBeenCalledTimes(6);
	});

	it('takes its lock connection from the budget shared with the other lock holders of the process, as onboarding', async () => {
		const runner = {
			connect: jest.fn(async () => undefined),
			startTransaction: jest.fn(async () => undefined),
			query: jest.fn<Promise<unknown>, [string, unknown[]?]>(async () => undefined),
			commitTransaction: jest.fn(async () => undefined),
			rollbackTransaction: jest.fn(async () => undefined),
			release: jest.fn(async () => undefined)
		};
		const createQueryRunner = jest.fn(() => runner);
		// A pool of two: one connection may be set aside for a lock, the other is for the locked work
		const service = serviceOn({ options: { type: 'postgres', poolSize: 2 }, createQueryRunner });
		jest.spyOn(service, 'find').mockResolvedValue([]);
		const create = jest.spyOn(service, 'create').mockImplementation(async (notification) => notification as never);

		// An onboarding of the same process holds that one slot, with its lock connection
		await takeLockConnectionSlot(lockConnectionSlots({ poolSize: 2 }));
		const request = service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, {
			...input,
			organizationId: ORGANIZATION_B
		});
		try {
			for (let round = 0; round < 5; round++) {
				await roundTrip();
			}
			// The Board request waits for the slot, holding no connection: the onboarding's work has the other one
			expect(createQueryRunner).not.toHaveBeenCalled();
			expect(create).not.toHaveBeenCalled();
		} finally {
			releaseLockConnectionSlot();
		}
		await request;
		expect(createQueryRunner).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledTimes(2);
	});

	it('takes no database lock with a pool of one connection, which the work needs, and still files', async () => {
		const createQueryRunner = jest.fn();
		const service = serviceOn({ options: { type: 'postgres', poolSize: 1 }, createQueryRunner });
		jest.spyOn(service, 'find').mockResolvedValue([]);
		const create = jest.spyOn(service, 'create').mockImplementation(async (notification) => notification as never);

		await service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, {
			...input,
			organizationId: ORGANIZATION_B
		});

		expect(createQueryRunner).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledTimes(2);
	});
});
