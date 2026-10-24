import '../../../../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { CreateTimeSlotHandler } from './create-time-slot.handler';

/**
 * `POST /timesheet/time-slot` takes its body unvalidated, and a new slot was built from all of it. TypeORM's `save`
 * updates the row a body `id` names, so an employee could post another employee's slot id — of any tenant — and
 * have that slot rewritten as their own and returned with its screenshots; the cascading relations and the
 * `employee`/`tenant` relations were written as sent too. A new slot now takes only the tracked values.
 */
describe('CreateTimeSlotHandler new slot', () => {
	const TENANT = 'tenant-own';
	const ORGANIZATION = 'org-own';
	const EMPLOYEE = 'employee-own';

	let saved: any[];
	let handler: CreateTimeSlotHandler;

	/** A query builder whose single-row reads miss and whose list reads are empty: every slot is new. */
	const missingQuery = () => {
		const query: any = {
			alias: 'q',
			leftJoinAndSelect: () => query,
			where: () => query,
			andWhere: () => query,
			addOrderBy: () => query,
			getQueryAndParameters: () => ['', []],
			getOneOrFail: async () => Promise.reject(new Error('EntityNotFound')),
			getMany: async () => []
		};
		return query;
	};

	beforeEach(() => {
		saved = [];
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-own', name: 'Own' } as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.TIME_TRACKER
		);

		// Only the collaborators the TypeORM path touches; the rest of the constructor graph is irrelevant here.
		handler = Object.create(CreateTimeSlotHandler.prototype);
		Object.assign(handler, {
			ormType: 'typeorm',
			typeOrmTimeSlotRepository: {
				createQueryBuilder: missingQuery,
				save: jest.fn(async (slot: any) => {
					saved.push({ ...slot });
					return slot;
				}),
				findOne: jest.fn(async () => saved[saved.length - 1])
			},
			typeOrmTimeLogRepository: { createQueryBuilder: missingQuery, update: jest.fn() },
			_commandBus: { execute: jest.fn(async () => []) },
			// A field the skipped constructor sets; the handler logs each step at debug level.
			logger: { debug: jest.fn() }
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it('does not take a row id, owner, tenant or related rows from the body', async () => {
		await handler.execute(
			new CreateTimeSlotCommand({
				id: 'victim-slot',
				organizationId: ORGANIZATION,
				startedAt: '2026-10-22T03:10:00.000Z',
				duration: 600,
				keyboard: 12,
				mouse: 34,
				overall: 56,
				tenant: { id: 'tenant-victim' },
				employee: { id: 'employee-victim' },
				screenshots: [{ id: 'victim-screenshot' }],
				timeSlotMinutes: [{ id: 'victim-minute' }],
				timeSlotSessions: [{ id: 'victim-session' }],
				createdByUserId: 'someone-else'
			} as any)
		);

		expect(saved).toHaveLength(1);
		const [slot] = saved;
		// CONTROL: each of these was persisted as sent before the fix
		for (const key of [
			'id',
			'tenant',
			'employee',
			'screenshots',
			'timeSlotMinutes',
			'timeSlotSessions',
			'createdByUserId'
		]) {
			expect(slot).not.toHaveProperty(key);
		}
		expect(slot).toMatchObject({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			duration: 600,
			keyboard: 12,
			mouse: 34,
			overall: 56
		});
		expect(new Date(slot.startedAt).toISOString()).toBe('2026-10-22T03:10:00.000Z');
	});

	it('keeps the activity values the agents send', async () => {
		await handler.execute(
			new CreateTimeSlotCommand({
				organizationId: ORGANIZATION,
				startedAt: '2026-10-22T03:20:00.000Z',
				location: 3,
				kbMouseActivity: { keyboard: [1], mouse: [2] },
				locationActivity: { moves: 3 },
				customActivity: { focus: 4 }
			} as any)
		);

		expect(saved[0]).toMatchObject({
			location: 3,
			kbMouseActivity: { keyboard: [1], mouse: [2] },
			locationActivity: { moves: 3 },
			customActivity: { focus: 4 }
		});
	});
});
