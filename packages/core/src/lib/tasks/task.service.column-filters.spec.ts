import '../core/entities/internal';

import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { Between, In, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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
});
