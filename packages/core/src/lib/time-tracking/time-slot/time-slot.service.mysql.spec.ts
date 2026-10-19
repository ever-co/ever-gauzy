import '../../core/entities/internal';

jest.mock('@gauzy/config', () => ({ ...jest.requireActual('@gauzy/config'), isMySQL: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { isMySQL } from '@gauzy/config';
import { IGetTimeSlotInput } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { mockRequestContext } from '../testing/recording-query-builder';
import { TypeOrmTimeSlotRepository } from './repository/type-orm-time-slot.repository';
import { TimeSlotService } from './time-slot.service';

/**
 * `GET /timesheet/time-slot` (TypeORM) built three of its conditions with raw double quotes, which MySQL reads
 * as strings: the query was a syntax error there. Every SQL fragment it builds is now MySQL-quoted on MySQL.
 */
describe('TimeSlotService.getTimeSlots on MySQL', () => {
	it('builds no double-quoted identifier', async () => {
		jest.mocked(isMySQL).mockReturnValue(true);
		let sql: string[] = [];
		const record = (fragment: unknown) => {
			if (typeof fragment === 'string') sql.push(fragment);
		};
		let query: Record<string, unknown> = { alias: 'time_slot' };
		query.leftJoin = jest.fn((_relation: string, _alias: string, condition?: string) => (record(condition), query));
		query.innerJoin = jest.fn(() => query);
		query.setFindOptions = jest.fn(() => query);
		query.andWhere = jest.fn((condition: unknown) => (record(condition), query));
		query.addOrderBy = jest.fn((sort: unknown) => (record(sort), query));
		query.where = jest.fn((factory: unknown) => {
			if (typeof factory === 'function') factory(query);
			return query;
		});
		query.getMany = jest.fn().mockResolvedValue([]);

		const module: TestingModule = await Test.createTestingModule({ providers: [TimeSlotService] })
			.useMocker((token) => {
				if (token === TypeOrmTimeSlotRepository) {
					return { metadata: { tableName: 'time_slot' }, createQueryBuilder: () => query };
				}
				if (token === CommandBus) {
					return { execute: jest.fn().mockResolvedValue([]) };
				}
				return {};
			})
			.compile();
		const service = module.get<TimeSlotService>(TimeSlotService);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		mockRequestContext({
			tenantId: 'tenant-1',
			user: { id: 'user-1', employeeId: 'employee-1' },
			canChangeSelectedEmployee: true
		});

		await service.getTimeSlots({
			organizationId: 'org-1',
			employeeIds: ['employee-1'],
			startDate: '2026-01-05T00:00:00.000Z',
			endDate: '2026-01-12T00:00:00.000Z'
		} as IGetTimeSlotInput);

		expect(sql.length).toBeGreaterThan(3);
		expect(sql.filter((fragment) => fragment.includes('"'))).toEqual([]);
		jest.restoreAllMocks();
	});
});
