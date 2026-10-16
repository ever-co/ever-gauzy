import '../../core/entities/internal';

import { knex as createKnex, Knex } from 'knex';
import { DatabaseTypeEnum } from '@gauzy/config';
import { IGetTimeSlotStatistics, ITimeSlotStatistics } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { StatisticService } from './statistic.service';

const mockUrl = jest.fn();
jest.mock('../../core/file-storage/file-storage', () => ({
	FileStorage: class {
		setProvider() {
			return this;
		}
		getProviderInstance() {
			return { url: (file: string) => mockUrl(file) };
		}
	}
}));

/**
 * The MikroORM branch of getEmployeeTimeSlots selected `screenshot.thumbUrl`, which is not a column (the
 * ScreenshotSubscriber computes it after load), so the dashboard's time slots answered 500. It now selects
 * the stored file, thumb and storage provider and resolves the URLs itself. The SQL is the real knex SQL
 * (Postgres dialect, no connection); awaiting a builder returns canned rows.
 */
describe('StatisticService.getEmployeeTimeSlots on MikroORM', () => {
	const { tenantA } = createCrossTenantFixture();
	const sqlBuilder = createKnex({ client: 'pg' });

	let restore: () => void;
	let queries: string[];

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		queries = [];
		mockUrl.mockReset();
		mockUrl.mockImplementation(async (file: string) => {
			if (file.startsWith('broken')) {
				throw new TypeError('Invalid URL');
			}
			return `https://files.example/${file}`;
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	afterAll(() => sqlBuilder.destroy());

	const recordingKnex = (...results: unknown[]) =>
		Object.assign(
			(table: string) => {
				const builder: Knex.QueryBuilder = sqlBuilder(table);
				const result = results.shift();
				(builder as unknown as { then: unknown }).then = (
					resolve: (value: unknown) => unknown,
					reject?: (reason: unknown) => unknown
				) => {
					queries.push(builder.toString());
					return Promise.resolve(result).then(resolve, reject);
				};
				return builder;
			},
			{ raw: sqlBuilder.raw.bind(sqlBuilder) }
		);

	const slot = (id: string, screenshot?: { id: string; file: string; thumb: string }) => ({
		id,
		employeeId: 'E1',
		startedAt: '2026-09-29T10:00:00.000Z',
		emp_id: 'E1',
		screenshot_id: screenshot?.id ?? null,
		screenshot_file: screenshot?.file ?? null,
		screenshot_thumb: screenshot?.thumb ?? null,
		screenshot_storageProvider: screenshot ? 'LOCAL' : null
	});

	const run = (logger = { warn: jest.fn(), debug: jest.fn(), log: jest.fn(), error: jest.fn() }) => {
		const knex = recordingKnex(
			[{ id: 'E1', user_id: 'U1', isOnline: true, isAway: false, startedAt: '2026-09-29T10:00:00.000Z' }],
			[
				slot('S1', { id: 'SS1', file: 'shot.png', thumb: 'shot-thumb.png' }),
				slot('S1', { id: 'SS2', file: 'broken.png', thumb: 'broken-thumb.png' }),
				// A slot whose screenshots are all soft-deleted: the ON clause leaves the screenshot columns empty
				slot('S2')
			]
		);
		const result = StatisticService.prototype.getEmployeeTimeSlots.call(
			{
				ormType: MultiORMEnum.MikroORM,
				logger,
				configService: { dbConnectionOptions: { type: DatabaseTypeEnum.postgres } },
				_managedEmployeeService: { filterAccessibleEmployeeIds: jest.fn().mockResolvedValue([]) },
				_userService: {
					findUsersByIds: jest
						.fn()
						.mockResolvedValue(new Map([['U1', { name: 'Ada Lovelace', imageUrl: 'ada.png' }]]))
				},
				mikroOrmTimeLogRepository: { getKnex: () => knex }
			},
			{
				organizationId: tenantA.organizationId,
				startDate: '2026-09-28',
				endDate: '2026-10-04'
			} as IGetTimeSlotStatistics
		) as Promise<ITimeSlotStatistics[]>;
		return { result, logger };
	};

	it('selects stored screenshot columns only, keeping slots whose screenshots are soft-deleted', async () => {
		await run().result;

		expect(queries).toHaveLength(2);
		const timeSlotSql = queries[1];
		expect(timeSlotSql).not.toContain('thumbUrl');
		expect(timeSlotSql).toContain('"screenshot"."storageProvider" as "screenshot_storageProvider"');
		expect(timeSlotSql).toContain(
			'left join "screenshot" on "time_slot"."id" = "screenshot"."timeSlotId" and "screenshot"."deletedAt" is null'
		);
	});

	it('resolves the screenshot URLs from storage; one unresolvable screenshot does not fail the response', async () => {
		const { result, logger } = run();
		const [employee] = await result;

		expect(employee.user).toEqual({ name: 'Ada Lovelace', imageUrl: 'ada.png' });
		const [first, second] = employee.timeSlots as any[];
		expect(first.id).toBe('S1');
		expect(first).not.toHaveProperty('screenshot_storageProvider');
		expect(first.screenshots).toEqual([
			{
				id: 'SS1',
				file: 'shot.png',
				thumb: 'shot-thumb.png',
				fullUrl: 'https://files.example/shot.png',
				thumbUrl: 'https://files.example/shot-thumb.png'
			},
			{ id: 'SS2', file: 'broken.png', thumb: 'broken-thumb.png', fullUrl: undefined, thumbUrl: undefined }
		]);
		expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('screenshot id=SS2'));
		expect(second.id).toBe('S2');
		expect(second.screenshots).toEqual([]);
	});
});
