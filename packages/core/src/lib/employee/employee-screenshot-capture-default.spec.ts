/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order (see employee.entity.spec.ts).
 */
import '../core/entities/internal';

import { FlushMode } from '@mikro-orm/core';
import { Organization } from '../core/entities/internal';
import {
	MikroOrmEntityManager,
	TypeOrmEntityManager
} from '../core/entities/subscribers/entity-event-subscriber.types';
import { MultiORMEnum } from '../core/utils';
import { Employee } from './employee.entity';
import { EmployeeSubscriber } from './employee.subscriber';
import { newEmployeeScreenshotCapture, readOrganizationScreenshotCapture } from './employee-screenshot-capture-default';

/**
 * Issue #9872 — the desktop apps capture when the EMPLOYEE flag is on, so a new employee now starts with its
 * organization's screen capture setting instead of the column default `true`. A value the write states wins, and
 * existing employees are never touched.
 */
describe('newEmployeeScreenshotCapture', () => {
	it.each([
		// requested, after the work-status rule, organization → stored
		[undefined, undefined, false, false],
		[undefined, undefined, true, true],
		[null, undefined, false, false],
		// Work starts at creation: the rule sets true, the organization still decides.
		[undefined, true, false, false],
		[undefined, true, true, true],
		// Work already ended at creation: off, as before.
		[undefined, false, true, false]
	])('requested %p, work-status %p, organization %p → %p', (requested, current, organization, expected) => {
		expect(newEmployeeScreenshotCapture(requested, current, organization)).toBe(expected);
	});

	it.each([
		[true, true],
		[false, false],
		['1', true]
	])('keeps today’s behaviour when the write states a value (%p)', (requested, current) => {
		expect(newEmployeeScreenshotCapture(requested, current, false)).toBe(current);
	});

	it('keeps today’s behaviour when the organization could not be read', () => {
		expect(newEmployeeScreenshotCapture(undefined, undefined, undefined)).toBeUndefined();
		expect(newEmployeeScreenshotCapture(undefined, true, null)).toBe(true);
	});
});

/** An entity manager of the given ORM whose `findOne` answers `row`. */
function entityManager(orm: 'typeorm' | 'mikro-orm', row: Record<string, unknown> | null) {
	const prototype = orm === 'typeorm' ? TypeOrmEntityManager.prototype : MikroOrmEntityManager.prototype;
	const em = Object.create(prototype);
	em.findOne = jest.fn().mockResolvedValue(row);
	return em as (TypeOrmEntityManager | MikroOrmEntityManager) & { findOne: jest.Mock };
}

describe('readOrganizationScreenshotCapture', () => {
	it('reads the flag with TypeORM, in the write’s own manager, scoped to the tenant', async () => {
		const em = entityManager('typeorm', { id: 'org-1', allowScreenshotCapture: false });

		await expect(readOrganizationScreenshotCapture(em, 'org-1', 'tenant-1', MultiORMEnum.TypeORM)).resolves.toBe(
			false
		);
		expect(em.findOne).toHaveBeenCalledWith(Organization, {
			where: { id: 'org-1', tenantId: 'tenant-1' },
			select: { id: true, allowScreenshotCapture: true }
		});
	});

	it('reads the flag with MikroORM without flushing from inside the hook', async () => {
		const em = entityManager('mikro-orm', { id: 'org-1', allowScreenshotCapture: true });

		await expect(readOrganizationScreenshotCapture(em, 'org-1', undefined, MultiORMEnum.MikroORM)).resolves.toBe(
			true
		);
		expect(em.findOne).toHaveBeenCalledWith(Organization, { id: 'org-1' }, { flushMode: FlushMode.COMMIT });
	});

	it('understands the 0/1 that SQLite and MySQL return', async () => {
		const em = entityManager('typeorm', { allowScreenshotCapture: 0 });

		await expect(readOrganizationScreenshotCapture(em, 'org-1', undefined, MultiORMEnum.TypeORM)).resolves.toBe(
			false
		);
	});

	it('answers undefined for a missing organization, a missing manager or a manager of the other ORM', async () => {
		await expect(
			readOrganizationScreenshotCapture(entityManager('typeorm', null), 'org-1', undefined, MultiORMEnum.TypeORM)
		).resolves.toBeUndefined();
		await expect(
			readOrganizationScreenshotCapture(undefined, 'org-1', undefined, MultiORMEnum.TypeORM)
		).resolves.toBeUndefined();
		await expect(
			readOrganizationScreenshotCapture(
				entityManager('mikro-orm', { allowScreenshotCapture: true }),
				'org-1',
				undefined,
				MultiORMEnum.TypeORM
			)
		).resolves.toBeUndefined();
	});
});

describe('EmployeeSubscriber — screen capture of a new employee', () => {
	const previousOrm = process.env.DB_ORM;

	afterEach(() => {
		jest.restoreAllMocks();
		if (previousOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previousOrm;
	});

	function setup(orm: 'typeorm' | 'mikro-orm', organization: Record<string, unknown> | null) {
		process.env.DB_ORM = orm === 'typeorm' ? MultiORMEnum.TypeORM : MultiORMEnum.MikroORM;
		const subscriber = new EmployeeSubscriber();
		// Starting work also updates the user's membership; that write is not under test here.
		jest.spyOn(subscriber, 'setUserOrganizationStatus').mockResolvedValue(undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		return { subscriber, em: entityManager(orm, organization) };
	}

	const newEmployee = (values: Partial<Employee> = {}) =>
		Object.assign(new Employee(), { id: 'employee-1', tenantId: 'tenant-1', organizationId: 'org-1', ...values });

	describe.each(['typeorm', 'mikro-orm'] as const)('with %s', (orm) => {
		it('starts with capture off in an organization that has it off', async () => {
			const { subscriber, em } = setup(orm, { allowScreenshotCapture: false });
			const employee = newEmployee();

			await subscriber.beforeEntityCreate(employee, em);

			expect(employee.allowScreenshotCapture).toBe(false);
		});

		it('starts with capture on in an organization that has it on (as before)', async () => {
			const { subscriber, em } = setup(orm, { allowScreenshotCapture: true });
			const employee = newEmployee();

			await subscriber.beforeEntityCreate(employee, em);

			expect(employee.allowScreenshotCapture).toBe(true);
		});

		it('follows the organization when the employee starts work on creation (the Add Employee form)', async () => {
			const { subscriber, em } = setup(orm, { allowScreenshotCapture: false });
			const employee = newEmployee({ startedWorkOn: new Date('2026-10-01') });

			await subscriber.beforeEntityCreate(employee, em);

			expect(employee).toMatchObject({ allowScreenshotCapture: false, isActive: true, isTrackingEnabled: true });
		});

		it('keeps a value the write states', async () => {
			const { subscriber, em } = setup(orm, { allowScreenshotCapture: false });
			const employee = newEmployee({ allowScreenshotCapture: true });

			await subscriber.beforeEntityCreate(employee, em);

			expect(employee.allowScreenshotCapture).toBe(true);
			expect(em.findOne).not.toHaveBeenCalled();
		});

		it('reads the organization from the relation when the write has no organizationId', async () => {
			const { subscriber, em } = setup(orm, { allowScreenshotCapture: false });
			const employee = newEmployee({ organizationId: undefined, organization: { id: 'org-2' } as never });

			await subscriber.beforeEntityCreate(employee, em);

			expect(employee.allowScreenshotCapture).toBe(false);
			expect(JSON.stringify(em.findOne.mock.calls[0])).toContain('org-2');
		});

		it('changes nothing when the organization cannot be read', async () => {
			const { subscriber, em } = setup(orm, null);
			const employee = newEmployee();

			await subscriber.beforeEntityCreate(employee, em);

			expect(employee.allowScreenshotCapture).toBeUndefined();
		});

		it('changes nothing, and does not throw, when reading the organization fails', async () => {
			const { subscriber, em } = setup(orm, null);
			em.findOne.mockRejectedValue(new Error('connection lost'));
			const employee = newEmployee();

			await expect(subscriber.beforeEntityCreate(employee, em)).resolves.toBeUndefined();
			expect(employee.allowScreenshotCapture).toBeUndefined();
		});

		it('never touches an existing employee', async () => {
			const { subscriber, em } = setup(orm, { allowScreenshotCapture: false });
			const employee = newEmployee({ allowScreenshotCapture: true, billRateValue: 50 });

			await subscriber.beforeEntityUpdate(employee, em, ['billRateValue']);

			expect(employee.allowScreenshotCapture).toBe(true);
			expect(em.findOne).not.toHaveBeenCalled();
		});
	});
});
