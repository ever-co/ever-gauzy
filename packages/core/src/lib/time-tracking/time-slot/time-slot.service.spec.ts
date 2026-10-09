/**
 * 🛑 This import must stay FIRST — see the note in `time-log.service.spec.ts`: loading the entity
 * barrel before any core service keeps `@IsEmployeeBelongsToOrganization()` from resolving to
 * `undefined` while `dashboard.entity.ts` applies it.
 */
import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IGetTimeSlotInput } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { mockRequestContext } from '../testing/recording-query-builder';
import { TypeOrmTimeSlotRepository } from './repository/type-orm-time-slot.repository';
import { TimeSlotService } from './time-slot.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const ORGANIZATION_ID = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const USER_ID = 'c3b2a190-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const OWN_EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';
const TARGET_EMPLOYEE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/** The subset of the query builder `getTimeSlots()` drives; it only has to execute, not filter. */
class TimeSlotQueryDouble {
	readonly alias = 'time_slot';
	leftJoin(): this {
		return this;
	}
	innerJoin(): this {
		return this;
	}
	setFindOptions(): this {
		return this;
	}
	where(factory: unknown): this {
		if (typeof factory === 'function') {
			factory(this);
		}
		return this;
	}
	andWhere(): this {
		return this;
	}
	addOrderBy(): this {
		return this;
	}
	async getMany(): Promise<never[]> {
		return [];
	}
}

/**
 * GHSA-6qvm-3wg4-26w4 — `getTimeSlots()` builds its own query, so the never-matching employee
 * condition of the CRUD reads (`findConditionsWithoutOwnEmployee`) never applies to it. The employee
 * predicate is only added when `employeeIds` is non-empty, and `employeeIds` is only narrowed for a
 * caller who HAS an employee record — so a caller with neither the permission nor an employee read
 * the whole organization's slots, or the ones they named in the body.
 */
describe('TimeSlotService.getTimeSlots employee scope', () => {
	let service: TimeSlotService;
	let createQueryBuilder: jest.Mock;

	const request: IGetTimeSlotInput = {
		organizationId: ORGANIZATION_ID,
		employeeIds: [TARGET_EMPLOYEE_ID],
		startDate: '2026-01-05T00:00:00.000Z',
		endDate: '2026-01-12T00:00:00.000Z'
	} as IGetTimeSlotInput;

	beforeEach(async () => {
		createQueryBuilder = jest.fn(() => new TimeSlotQueryDouble());

		const module: TestingModule = await Test.createTestingModule({ providers: [TimeSlotService] })
			.useMocker((token) => {
				if (token === TypeOrmTimeSlotRepository) {
					return { metadata: { tableName: 'time_slot' }, createQueryBuilder };
				}
				if (token === CommandBus) {
					return { execute: jest.fn().mockResolvedValue([]) };
				}
				return {};
			})
			.compile();

		service = module.get<TimeSlotService>(TimeSlotService);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('returns nothing, without querying, for a caller with neither the permission nor an employee record', async () => {
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: USER_ID, employeeId: null },
			canChangeSelectedEmployee: false
		});

		await expect(service.getTimeSlots(request)).resolves.toEqual([]);
		expect(createQueryBuilder).not.toHaveBeenCalled();
	});

	it('CONTROL: the same caller state WITH an employee record still runs the query', async () => {
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: USER_ID, employeeId: OWN_EMPLOYEE_ID },
			canChangeSelectedEmployee: false
		});

		await service.getTimeSlots(request);

		expect(createQueryBuilder).toHaveBeenCalled();
	});

	it('CONTROL: a caller holding CHANGE_SELECTED_EMPLOYEE still runs the query', async () => {
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: USER_ID, employeeId: null },
			canChangeSelectedEmployee: true
		});

		await service.getTimeSlots(request);

		expect(createQueryBuilder).toHaveBeenCalled();
	});
});
