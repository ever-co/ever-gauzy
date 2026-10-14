// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import * as moment from 'moment';
import { TimeSlotBulkCreateCommand } from '../time-slot-bulk-create.command';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';
import { TimeSlotBulkCreateHandler } from './time-slot-bulk-create.handler';

/**
 * A time log links the slots `TimeSlotBulkCreateHandler` hands back. When every slot of the log already existed —
 * the Hubstaff sync creates each slot (with its activity) through its slot mapping before it creates the time log —
 * the handler returned `[]`, so the imported log was saved without slots and the reports that read a log's slots
 * left it out.
 */
describe('TimeSlotBulkCreateHandler', () => {
	const slot = (minute: string) => ({ startedAt: new Date(`2026-10-12T10:${minute}:00.000Z`), keyboard: 5 });
	const merged = [{ id: 'merged-1' }, { id: 'merged-2' }];

	const setup = (existing: 'all' | 'first') => {
		// The starts the handler looked up (normalised as it stores them), so the merged span can be checked
		let requestedStarts: unknown[] = [];
		const typeOrmTimeSlotRepository = {
			// The slots already stored: every requested start, or only the first one
			find: jest.fn(async ({ where }) => {
				const starts: unknown[] = where.startedAt.value;
				requestedStarts = starts;
				return (existing === 'all' ? starts : starts.slice(0, 1)).map((startedAt, i) => ({
					id: `existing-${i}`,
					startedAt
				}));
			}),
			save: jest.fn(async (rows) => rows)
		};
		const typeOrmTimeLogRepository = { find: jest.fn(async () => []) };
		const commandBus = { execute: jest.fn(async () => merged) };
		const handler = new TimeSlotBulkCreateHandler(
			typeOrmTimeLogRepository as never,
			typeOrmTimeSlotRepository as never,
			commandBus as never
		);
		const run = () =>
			handler.execute(
				new TimeSlotBulkCreateCommand([slot('00'), slot('10')] as never, 'employee-1', 'org-1', 'tenant-1')
			);
		// The span the merge must cover: from the first slot's start to the last one's
		const span = () => ({
			start: moment(requestedStarts[0]).toDate(),
			end: moment(requestedStarts[requestedStarts.length - 1]).toDate()
		});
		return { run, typeOrmTimeSlotRepository, commandBus, span };
	};

	it('hands back the existing slots, merged, when every slot already exists', async () => {
		const { run, typeOrmTimeSlotRepository, commandBus, span } = setup('all');

		expect(await run()).toEqual(merged);
		expect(typeOrmTimeSlotRepository.save).not.toHaveBeenCalled();
		const [[merge]] = commandBus.execute.mock.calls as unknown as [[TimeSlotMergeCommand]];
		expect(merge).toBeInstanceOf(TimeSlotMergeCommand);
		expect(merge).toMatchObject({ organizationId: 'org-1', employeeId: 'employee-1', ...span() });
	});

	it('still inserts only the new slots, then hands back the merged span', async () => {
		const { run, typeOrmTimeSlotRepository, commandBus, span } = setup('first');

		expect(await run()).toEqual(merged);
		expect(typeOrmTimeSlotRepository.save).toHaveBeenCalledTimes(1);
		expect(typeOrmTimeSlotRepository.save.mock.calls[0][0]).toHaveLength(1);
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect((commandBus.execute.mock.calls as unknown as [[TimeSlotMergeCommand]])[0][0]).toMatchObject({
			organizationId: 'org-1',
			employeeId: 'employee-1',
			...span()
		});
	});
});
