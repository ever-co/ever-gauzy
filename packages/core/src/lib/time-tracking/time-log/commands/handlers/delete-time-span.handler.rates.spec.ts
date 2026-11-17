// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimeLog } from '../../time-log.entity';
import { DeleteTimeSpanHandler } from './delete-time-span.handler';

/** What the log stores, the hidden rates included, as a read naming them returns it. */
const STORED_RATES = {
	billRateValue: 40,
	billRateCurrency: 'EUR',
	payRateValue: 25,
	payRateCurrency: 'EUR',
	projectBillRateValue: 90,
	projectMemberBillRateValue: 95,
	projectBillRateCurrency: 'EUR',
	projectMemberBillRateCurrency: 'EUR',
	ratesStored: true
};

/** The log as a generic read loads it: the hidden rates are not there. */
const LOG = Object.assign(new TimeLog(), {
	id: 'log-1',
	tenantId: 'tenant-1',
	organizationId: 'organization-1',
	employeeId: 'marie',
	projectId: 'site',
	startedAt: new Date('2026-10-12T09:00:00.000Z'),
	stoppedAt: new Date('2026-10-12T13:00:00.000Z'),
	billRateValue: 40,
	billRateCurrency: 'EUR',
	ratesStored: true,
	timeSlots: []
});

/**
 * Manual time over the middle of a log splits it, and the part after the new range is a new log. It is the same
 * time, so it is priced as the log was: it carries every rate the log stores.
 */
describe('DeleteTimeSpanHandler: the second part of a split keeps the rates of the log', () => {
	it('copies the rates the log stores, the hidden ones included', async () => {
		const timeLogRepository = {
			findOne: jest.fn(async () => ({ id: 'log-1', ...STORED_RATES })),
			save: jest.fn(async (timeLog: TimeLog) => timeLog)
		};
		const handler = new DeleteTimeSpanHandler(timeLogRepository as any, {} as any, { execute: jest.fn() } as any);

		const secondPart: TimeLog = await (handler as any).createSecondPart(
			LOG,
			new Date('2026-10-12T11:00:00.000Z'),
			LOG.stoppedAt
		);

		expect(secondPart).toMatchObject({ ...STORED_RATES, startedAt: new Date('2026-10-12T11:00:00.000Z') });
		expect(timeLogRepository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'log-1' }, select: expect.objectContaining({ payRateValue: true }) })
		);
	});

	it('files the second part under the tags of the log, which its read of the log leaves out (ever-co/ever-gauzy#12029)', async () => {
		const tags = [{ id: 'meeting' }, { id: 'design' }];
		const timeLogRepository = {
			findOne: jest.fn(async (options: { relations?: { tags?: boolean } }) =>
				options.relations?.tags ? { id: 'log-1', tags } : { id: 'log-1', ...STORED_RATES }
			),
			save: jest.fn(async (timeLog: TimeLog) => timeLog)
		};
		const handler = new DeleteTimeSpanHandler(timeLogRepository as any, {} as any, { execute: jest.fn() } as any);

		const secondPart: TimeLog = await (handler as any).createSecondPart(
			{ ...LOG, tags: undefined },
			new Date('2026-10-12T11:00:00.000Z'),
			LOG.stoppedAt
		);

		expect(secondPart.tags).toEqual(tags);
	});

	it('keeps the link to a tag that is soft deleted, so a restored tag is on both parts (ever-co/ever-gauzy#12029)', async () => {
		const live = { id: 'meeting' };
		const archived = { id: 'retired' };
		const timeLogRepository = {
			findOne: jest.fn(async (options: { relations?: { tags?: boolean }; withDeleted?: boolean }) => {
				if (!options.relations?.tags) {
					return { id: 'log-1', ...STORED_RATES };
				}
				// A plain read leaves the soft deleted tag out of the relation, as the ORM does
				const tags = options.withDeleted ? [live, archived] : [live];
				return { id: 'log-1', tags };
			}),
			save: jest.fn(async (timeLog: TimeLog) => timeLog)
		};
		const handler = new DeleteTimeSpanHandler(timeLogRepository as any, {} as any, { execute: jest.fn() } as any);

		const secondPart: TimeLog = await (handler as any).createSecondPart(
			{ ...LOG, tags: undefined },
			new Date('2026-10-12T11:00:00.000Z'),
			LOG.stoppedAt
		);

		expect(secondPart.tags).toEqual([live, archived]);
	});
});
