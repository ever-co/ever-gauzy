jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import '../../core/entities/internal';

import { DatabaseTypeEnum, defineConfig } from '@gauzy/config';
import { IGetTimeSlotStatistics, ITimeSlotStatistics } from '@gauzy/contracts';
import { knex as createKnex, Knex } from 'knex';
import { FileStorage } from '../../core/file-storage/file-storage';
import { MultiORMEnum } from '../../core/utils';
import { StatisticService } from './statistic.service';

/**
 * #10744 — the time-slots statistics (`GET /timesheet/statistics/time-slots`, `timeTrackingTimeSlots`) on
 * MikroORM, against a real in-memory SQLite store through knex, as the MikroORM branch runs.
 *
 * The branch selected `screenshot.thumbUrl`, which is a virtual property of `Screenshot` and no column, so the
 * read failed (`no such column`, a 500) as soon as an employee had tracked time in the range. It now selects
 * the storage provider and resolves `thumbUrl` and `fullUrl` as `ScreenshotSubscriber` does on TypeORM, and
 * leaves soft-removed screenshots out of the join without losing the slot they belong to.
 */

const TENANT_ID = '10744000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '10744000-0000-4000-8000-0000000000bb';
const EMPLOYEE_ID = '10744000-0000-4000-8000-000000000001';
const USER_ID = '10744000-0000-4000-8000-000000000002';
const LOG_ID = '10744000-0000-4000-8000-000000000003';

const request = {
	tenantId: TENANT_ID,
	organizationId: ORGANIZATION_ID,
	startDate: '2026-10-12T00:00:00.000Z',
	endDate: '2026-10-12T23:59:59.000Z'
} as IGetTimeSlotStatistics;

/** Three slots of one log: live screenshots on two storages, only soft-removed ones, and none at all. */
const SLOTS = [
	{ id: 'slot-with-screenshots', startedAt: '2026-10-12 09:20:00.000' },
	{ id: 'slot-with-removed-screenshots', startedAt: '2026-10-12 09:10:00.000' },
	{ id: 'slot-without-screenshots', startedAt: '2026-10-12 09:00:00.000' }
];

const SCREENSHOTS = [
	{
		id: 'screenshot-local',
		timeSlotId: 'slot-with-screenshots',
		file: 'screenshots/local.png',
		thumb: 'screenshots/thumb/local.png',
		storageProvider: 'LOCAL',
		deletedAt: null
	},
	{
		id: 'screenshot-s3',
		timeSlotId: 'slot-with-screenshots',
		file: 'screenshots/s3.png',
		thumb: 'screenshots/thumb/s3.png',
		storageProvider: 'S3',
		deletedAt: null
	},
	{
		id: 'screenshot-removed-beside-live',
		timeSlotId: 'slot-with-screenshots',
		file: 'screenshots/removed-a.png',
		thumb: 'screenshots/thumb/removed-a.png',
		storageProvider: 'LOCAL',
		deletedAt: '2026-10-12 10:00:00.000'
	},
	{
		id: 'screenshot-removed',
		timeSlotId: 'slot-with-removed-screenshots',
		file: 'screenshots/removed-b.png',
		thumb: 'screenshots/thumb/removed-b.png',
		storageProvider: 'LOCAL',
		deletedAt: '2026-10-12 10:00:00.000'
	}
];

class TimeSlotsStatisticService extends StatisticService {
	constructor(knex: Knex) {
		super(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{ getKnex: () => knex } as any,
			{ findUsersByIds: async () => new Map([[USER_ID, { name: 'Ada', imageUrl: null }]]) } as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } } as any,
			{ filterAccessibleEmployeeIds: async (employeeIds: string[]) => employeeIds } as any
		);
		this.ormType = MultiORMEnum.MikroORM;
	}
}

describe('StatisticService.getEmployeeTimeSlots on MikroORM', () => {
	let knex: Knex;

	// getDateRangeFormat reads the global config: pin it so the range uses SQLite's text format.
	beforeAll(async () => {
		defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } });

		knex = createKnex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

		await knex.schema.createTable('user', (table) => {
			table.string('id').primary();
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('employee', (table) => {
			table.string('id').primary();
			table.string('userId');
			table.boolean('isOnline');
			table.boolean('isAway');
			// `AddEmployeeKind1791000000721`: the read answers it, so the agents can be told from the people.
			table.string('kind', 16).notNullable().defaultTo('human');
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('time_log', (table) => {
			table.string('id').primary();
			['tenantId', 'organizationId', 'employeeId', 'projectId', 'organizationTeamId', 'startedAt'].forEach(
				(column) => table.string(column).nullable()
			);
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('time_slot', (table) => {
			table.string('id').primary();
			['tenantId', 'organizationId', 'employeeId', 'startedAt'].forEach((column) => table.string(column));
			table.integer('duration');
			table.integer('overall');
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('time_slot_time_logs', (table) => {
			table.string('timeSlotId');
			table.string('timeLogId');
		});
		// The columns the platform's migrations give a screenshot; `thumbUrl` and `fullUrl` are not among them.
		await knex.schema.createTable('screenshot', (table) => {
			table.string('id').primary();
			table.string('timeSlotId');
			table.string('file');
			table.string('thumb');
			table.string('storageProvider').nullable();
			table.string('deletedAt').nullable();
		});

		await knex('user').insert({ id: USER_ID });
		await knex('employee').insert({ id: EMPLOYEE_ID, userId: USER_ID, isOnline: false, isAway: false });
		await knex('time_log').insert({
			id: LOG_ID,
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: '2026-10-12 09:00:00.000'
		});
		for (const slot of SLOTS) {
			await knex('time_slot').insert({
				...slot,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				employeeId: EMPLOYEE_ID,
				duration: 600,
				overall: 300
			});
			await knex('time_slot_time_logs').insert({ timeSlotId: slot.id, timeLogId: LOG_ID });
		}
		await knex('screenshot').insert(SCREENSHOTS);
	});

	afterAll(async () => {
		await knex?.destroy();
	});

	beforeEach(() => {
		// The URL each provider answers, named after the provider the screenshot was read with.
		jest.spyOn(FileStorage.prototype, 'getProviderInstance').mockImplementation(function (this: FileStorage) {
			const provider = this.config.provider;
			return {
				url: async (file: string) => {
					if (file?.includes('broken')) {
						throw new TypeError('Invalid URL');
					}
					return `https://${String(provider).toLowerCase()}.files.test/${file}`;
				}
			} as any;
		});
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await knex('screenshot').where('id', 'screenshot-broken').delete();
	});

	const slotsOf = (employees: ITimeSlotStatistics[]) => {
		expect(employees.map((employee) => employee.id)).toEqual([EMPLOYEE_ID]);
		return employees[0].timeSlots as any[];
	};

	it('answers every slot, with the live screenshots and the URLs their own storage resolves', async () => {
		const employees = await new TimeSlotsStatisticService(knex).getEmployeeTimeSlots(request);
		const slots = slotsOf(employees);

		expect(slots.map((slot) => slot.id)).toEqual(SLOTS.map((slot) => slot.id));
		expect(slots[0].screenshots).toEqual([
			{
				id: 'screenshot-local',
				file: 'screenshots/local.png',
				thumb: 'screenshots/thumb/local.png',
				fullUrl: 'https://local.files.test/screenshots/local.png',
				thumbUrl: 'https://local.files.test/screenshots/thumb/local.png'
			},
			{
				id: 'screenshot-s3',
				file: 'screenshots/s3.png',
				thumb: 'screenshots/thumb/s3.png',
				fullUrl: 'https://s3.files.test/screenshots/s3.png',
				thumbUrl: 'https://s3.files.test/screenshots/thumb/s3.png'
			}
		]);
	});

	it('keeps a slot whose screenshots were all soft-removed, without them', async () => {
		const slots = slotsOf(await new TimeSlotsStatisticService(knex).getEmployeeTimeSlots(request));

		expect(slots[1].id).toBe('slot-with-removed-screenshots');
		expect(slots[1].screenshots).toEqual([]);
		expect(slots[2].screenshots).toEqual([]);
	});

	it('does not expose the storage provider on the slot', async () => {
		const slots = slotsOf(await new TimeSlotsStatisticService(knex).getEmployeeTimeSlots(request));

		for (const slot of slots) {
			expect(Object.keys(slot)).not.toContain('screenshot_storageProvider');
		}
	});

	it('answers a screenshot whose URLs cannot be built without them, and every other one as usual', async () => {
		await knex('screenshot').insert({
			id: 'screenshot-broken',
			timeSlotId: 'slot-with-screenshots',
			file: 'screenshots/broken.png',
			thumb: 'screenshots/thumb/broken.png',
			storageProvider: 'LOCAL'
		});
		const service = new TimeSlotsStatisticService(knex);
		jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

		const slots = slotsOf(await service.getEmployeeTimeSlots(request));
		const screenshots = slots[0].screenshots as any[];

		expect(screenshots.map((screenshot) => screenshot.id).sort()).toEqual(
			['screenshot-broken', 'screenshot-local', 'screenshot-s3'].sort()
		);
		const broken = screenshots.find((screenshot) => screenshot.id === 'screenshot-broken');
		expect(broken.fullUrl).toBeUndefined();
		expect(broken.thumbUrl).toBeUndefined();
		expect(screenshots.find((screenshot) => screenshot.id === 'screenshot-s3').thumbUrl).toBe(
			'https://s3.files.test/screenshots/thumb/s3.png'
		);
	});
});
