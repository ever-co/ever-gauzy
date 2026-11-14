import '../core/entities/internal';

import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { And, Between, In, IsNull, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual, Not } from 'typeorm';
import { convertTypeORMWhereToMikroORM } from '../core/utils';
import { TaskService } from './task.service';

/**
 * The advanced task filters gained column filters — `statuses`, `priorities` and a due-date range or
 * "no due date" — so a paginated list (the Project Management dashboard) can narrow on the server
 * instead of hiding rows it has not loaded yet. The TypeORM `where` and the MikroORM employee query
 * must agree on them, and a key the caller already set in `where` must keep winning.
 */
describe('TaskService advanced column filters', () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const service: any = Object.create(TaskService.prototype);
	const FROM = '2026-10-01T00:00:00.000Z';
	const TO = '2026-10-31T23:59:59.999Z';

	describe('TypeORM where', () => {
		const build = (filters: object, where: object = {}) => service.buildAdvancedWhereCondition(filters, where);

		it('adds nothing when no column filter is set', () => {
			expect(build({})).toEqual({});
		});

		it('matches any of the given statuses and priorities', () => {
			expect(
				build({
					statuses: [TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED],
					priorities: [TaskPriorityEnum.URGENT]
				})
			).toEqual({
				status: In([TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED]),
				priority: In([TaskPriorityEnum.URGENT])
			});
		});

		it('keeps a status or priority already in where', () => {
			const where = { status: TaskStatusEnum.OPEN, priority: TaskPriorityEnum.LOW };
			expect(build({ statuses: [TaskStatusEnum.DONE], priorities: [TaskPriorityEnum.HIGH] }, where)).toEqual({});
		});

		it('builds a closed, open-ended or empty due-date range', () => {
			expect(build({ dueDateFrom: FROM, dueDateTo: TO })).toEqual({
				dueDate: Between(new Date(FROM), new Date(TO))
			});
			expect(build({ dueDateFrom: FROM })).toEqual({ dueDate: MoreThanOrEqual(new Date(FROM)) });
			expect(build({ dueDateTo: TO })).toEqual({ dueDate: LessThanOrEqual(new Date(TO)) });
		});

		it('lets "no due date" win over a range sent with it', () => {
			expect(build({ withoutDueDate: true, dueDateFrom: FROM, dueDateTo: TO })).toEqual({ dueDate: IsNull() });
		});

		it('ignores an invalid date instead of querying with it', () => {
			expect(build({ dueDateFrom: 'not a date', dueDateTo: TO })).toEqual({
				dueDate: LessThanOrEqual(new Date(TO))
			});
		});
	});

	describe('MikroORM employee query', () => {
		const build = (filters: object, where: object = {}) => service.mikroOrmColumnFilters(filters, where);

		it('uses $in for statuses and priorities, and keeps keys already in where', () => {
			expect(build({ statuses: [TaskStatusEnum.IN_PROGRESS], priorities: [TaskPriorityEnum.HIGH] })).toEqual({
				status: { $in: [TaskStatusEnum.IN_PROGRESS] },
				priority: { $in: [TaskPriorityEnum.HIGH] }
			});
			expect(build({ statuses: [TaskStatusEnum.DONE] }, { status: TaskStatusEnum.OPEN })).toEqual({});
		});

		it('uses $gte / $lte for the due-date range and null for "no due date"', () => {
			expect(build({ dueDateFrom: FROM, dueDateTo: TO })).toEqual({
				dueDate: { $gte: new Date(FROM), $lte: new Date(TO) }
			});
			expect(build({ dueDateTo: TO })).toEqual({ dueDate: { $lte: new Date(TO) } });
			expect(build({ withoutDueDate: true, dueDateFrom: FROM })).toEqual({ dueDate: null });
		});
	});

	/**
	 * "Due today" for a reader in UTC−4, as the dashboard sends it: the instants of the reader's day and the day itself.
	 * A date-only due date is midnight UTC of its day, which is 20:00 the evening before there.
	 */
	describe('a range whose ends come with their calendar days', () => {
		const today = {
			dueDateFrom: '2026-11-18T04:00:00.000Z',
			dueDateFromDay: '2026-11-18',
			dueDateTo: '2026-11-19T03:59:59.999Z',
			dueDateToDay: '2026-11-18'
		};

		it('compares a date-only due date with the days in the TypeORM where, in operators MikroORM translates', () => {
			const midnight18 = new Date('2026-11-18T00:00:00.000Z');
			const midnight19 = new Date('2026-11-19T00:00:00.000Z');
			const where = service.buildAdvancedWhereCondition(today, {});
			// On or after the 18th's midnight but not between it and the reader's midnight; up to the reader's last
			// instant of the 18th but not the 19th's midnight.
			expect(where).toEqual({
				dueDate: And(
					MoreThanOrEqual(midnight18),
					Not(And(MoreThan(midnight18), LessThan(new Date(today.dueDateFrom)))),
					LessThanOrEqual(new Date(today.dueDateTo)),
					Not(midnight19)
				)
			});
			// The base `paginate` under DB_ORM=mikro-orm translates this `where`; it refuses `Raw`.
			expect(convertTypeORMWhereToMikroORM({ tenantId: 'ten', ...where } as never)).toEqual({
				tenantId: 'ten',
				dueDate: { $gte: midnight18, $lte: new Date(today.dueDateTo), $ne: midnight19 },
				$and: [{ $not: { dueDate: { $gt: midnight18, $lt: new Date(today.dueDateFrom) } } }]
			});
		});

		it('says the same in the MikroORM employee query, next to an $and already there', () => {
			expect(service.mikroOrmColumnFilters(today, { $and: [{ isDraft: false }] })).toEqual({
				$and: [
					{ isDraft: false },
					{
						$or: [
							{ dueDate: { $gte: new Date(today.dueDateFrom) } },
							{ dueDate: { $in: [new Date('2026-11-18T00:00:00.000Z')] } }
						]
					},
					{ dueDate: { $lte: new Date(today.dueDateTo), $nin: [new Date('2026-11-19T00:00:00.000Z')] } }
				]
			});
		});

		it('compares the instants as before without the days, or with a day the instant is not an edge of', () => {
			const instants = { dueDateFrom: today.dueDateFrom, dueDateTo: today.dueDateTo };
			expect(service.buildAdvancedWhereCondition(instants, {})).toEqual({
				dueDate: Between(new Date(today.dueDateFrom), new Date(today.dueDateTo))
			});
			expect(
				service.buildAdvancedWhereCondition(
					{ ...today, dueDateFromDay: '2026-11-25', dueDateToDay: '2026-11-25' },
					{}
				)
			).toEqual({
				dueDate: Between(new Date(today.dueDateFrom), new Date(today.dueDateTo))
			});
			expect(service.mikroOrmColumnFilters(instants, {})).toEqual({
				dueDate: { $gte: new Date(today.dueDateFrom), $lte: new Date(today.dueDateTo) }
			});
			// "No due date" still wins.
			expect(service.buildAdvancedWhereCondition({ ...today, withoutDueDate: true }, {})).toEqual({
				dueDate: IsNull()
			});
		});
	});
});
