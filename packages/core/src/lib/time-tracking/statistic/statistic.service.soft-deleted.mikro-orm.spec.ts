jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import '../../core/entities/internal';

import { DatabaseTypeEnum, defineConfig } from '@gauzy/config';
import { IGetCountsStatistics, IGetManualTimesStatistics } from '@gauzy/contracts';
import { knex as createKnex, Knex } from 'knex';
import { MultiORMEnum } from '../../core/utils';
import { StatisticService } from './statistic.service';

/**
 * #10752 — the dashboard statistics on MikroORM leave soft-deleted rows out, as on TypeORM.
 *
 * The MikroORM branches query through raw knex, which MikroORM's soft-delete filter never sees, so a deleted time
 * log (or the time slot, employee or project it joins) still counted. The TypeORM query builder adds the
 * `deletedAt IS NULL` condition for the main entity and every joined one on its own — in the ON clause for a left
 * join, so a manual time whose project was deleted is still listed, without its project. Run here against a real
 * in-memory SQLite store through knex, as the MikroORM branches run.
 */

const TENANT_ID = '10752000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '10752000-0000-4000-8000-0000000000bb';
const ADA = '10752000-0000-4000-8000-000000000001';
const BOB = '10752000-0000-4000-8000-000000000002';
const LIVE_PROJECT = '10752000-0000-4000-8000-000000000011';
const DELETED_PROJECT = '10752000-0000-4000-8000-000000000012';

const DELETED = '2026-10-12 18:00:00.000';

const range = {
	tenantId: TENANT_ID,
	organizationId: ORGANIZATION_ID,
	startDate: '2026-10-12T00:00:00.000Z',
	endDate: '2026-10-12T23:59:59.000Z'
};

/**
 * Every log has one slot in the range.
 * - `log-tracked`: Ada on the live project — the only one every count keeps.
 * - `log-deleted`: Bob's manual time, soft-deleted — Bob worked nothing that counts.
 * - `log-on-deleted-project`: Ada's manual time on the deleted project — listed, but the project is not counted.
 * - `log-with-deleted-slot`: Ada's manual time whose only slot is soft-deleted.
 */
const LOGS = [
	{
		id: 'log-tracked',
		employeeId: ADA,
		projectId: LIVE_PROJECT,
		logType: 'TRACKED',
		startedAt: '2026-10-12 09:00:00.000'
	},
	{
		id: 'log-deleted',
		employeeId: BOB,
		projectId: LIVE_PROJECT,
		logType: 'MANUAL',
		startedAt: '2026-10-12 10:00:00.000',
		deletedAt: DELETED
	},
	{
		id: 'log-on-deleted-project',
		employeeId: ADA,
		projectId: DELETED_PROJECT,
		logType: 'MANUAL',
		startedAt: '2026-10-12 11:00:00.000'
	},
	{
		id: 'log-with-deleted-slot',
		employeeId: ADA,
		projectId: LIVE_PROJECT,
		logType: 'MANUAL',
		startedAt: '2026-10-12 12:00:00.000',
		slotDeletedAt: DELETED
	}
];

class SoftDeletedStatisticService extends StatisticService {
	constructor(knex: Knex) {
		super(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{ getKnex: () => knex } as any,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } } as any,
			{ filterAccessibleEmployeeIds: async (employeeIds: string[]) => employeeIds } as any
		);
		this.ormType = MultiORMEnum.MikroORM;
	}
}

describe('StatisticService on MikroORM — soft-deleted rows', () => {
	let knex: Knex;
	let service: SoftDeletedStatisticService;

	// getDateRangeFormat reads the global config: pin it so the range uses SQLite's text format.
	beforeAll(async () => {
		defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } });

		knex = createKnex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

		await knex.schema.createTable('user', (table) => {
			table.string('id').primary();
			table.string('firstName');
			table.string('lastName');
			table.string('imageUrl').nullable();
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('employee', (table) => {
			table.string('id').primary();
			table.string('userId');
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('organization_project', (table) => {
			table.string('id').primary();
			table.string('name');
			table.string('imageUrl').nullable();
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('time_log', (table) => {
			table.string('id').primary();
			[
				'tenantId',
				'organizationId',
				'employeeId',
				'projectId',
				'organizationTeamId',
				'logType',
				'source'
			].forEach((column) => table.string(column).nullable());
			table.string('startedAt');
			table.integer('duration').nullable();
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('time_slot', (table) => {
			table.string('id').primary();
			['tenantId', 'organizationId', 'employeeId', 'startedAt'].forEach((column) => table.string(column));
			table.integer('overall');
			table.integer('duration');
			table.string('deletedAt').nullable();
		});
		await knex.schema.createTable('time_slot_time_logs', (table) => {
			table.string('timeSlotId');
			table.string('timeLogId');
		});

		await knex('user').insert([
			{ id: 'user-ada', firstName: 'Ada', lastName: 'Lovelace' },
			{ id: 'user-bob', firstName: 'Bob', lastName: 'Builder' }
		]);
		await knex('employee').insert([
			{ id: ADA, userId: 'user-ada' },
			{ id: BOB, userId: 'user-bob' }
		]);
		await knex('organization_project').insert([
			{ id: LIVE_PROJECT, name: 'Live' },
			{ id: DELETED_PROJECT, name: 'Gone', deletedAt: DELETED }
		]);
		for (const { slotDeletedAt, ...log } of LOGS) {
			await knex('time_log').insert({
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				source: 'BROWSER',
				duration: 600,
				deletedAt: null,
				...log
			});
			await knex('time_slot').insert({
				id: `slot-of-${log.id}`,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				employeeId: log.employeeId,
				startedAt: log.startedAt,
				overall: 300,
				duration: 600,
				deletedAt: slotDeletedAt ?? null
			});
			await knex('time_slot_time_logs').insert({ timeSlotId: `slot-of-${log.id}`, timeLogId: log.id });
		}

		service = new SoftDeletedStatisticService(knex);
	});

	afterAll(async () => {
		await knex?.destroy();
	});

	it('counts only the employees whose live logs have a live slot', async () => {
		await expect((service as any).getEmployeeWorkedCounts(range as IGetCountsStatistics)).resolves.toBe(1);
	});

	it('counts only the live projects worked on through live logs and slots', async () => {
		await expect((service as any).getProjectWorkedCounts(range as IGetCountsStatistics)).resolves.toBe(1);
	});

	it('lists the live manual times, and one whose project was deleted without its project', async () => {
		const manualTimes = await service.manualTimes(range as IGetManualTimesStatistics);

		expect(manualTimes.map((manualTime) => manualTime.id)).toEqual(['log-on-deleted-project']);
		expect(manualTimes[0]).toMatchObject({
			employeeId: ADA,
			user: { name: 'Ada Lovelace' },
			project: { name: null }
		});
	});
});
