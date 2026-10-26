// The dialect helpers read DB_TYPE once, when @gauzy/config loads; this file runs as the demo does (better-sqlite3), so
// the entity subscriber serializes `data` to text exactly as it does there.
jest.mock('@gauzy/config', () => {
	process.env.DB_TYPE = 'better-sqlite3';
	return jest.requireActual('@gauzy/config');
});

import '../core/entities/internal';

import { DataSource } from 'typeorm';
import { EmployeeSettingDataOperationEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmployeeSetting } from './employee-setting.entity';
import { EmployeeSettingService } from './employee-setting.service';

const { SET } = EmployeeSettingDataOperationEnum;
const TENANT = 'a0000000-0000-4000-8000-000000000001';
const EMPLOYEE = 'e0000000-0000-4000-8000-000000000001';
const SETTING = 'd0000000-0000-4000-8000-000000000001';

/** Booting the whole entity graph on SQLite takes a while. */
const ENTITY_GRAPH_TIMEOUT = 180_000;

/**
 * `patchData` through the production wiring on the demo stack: the real `EmployeeSetting` entity and its subscriber,
 * TypeORM's transaction and query builder, on better-sqlite3. TypeORM drives SQLite through ONE connection, where a
 * second transaction cannot start while the first is open ("cannot start a transaction within a transaction"); the
 * service queues its own transactions on the embedded dialect, so concurrent patches of different keys both land.
 */
describe('EmployeeSettingService.patchData on SQLite (production wiring)', () => {
	let dataSource: DataSource;
	let service: EmployeeSettingService;

	beforeAll(async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE);

		const { coreEntities } = require('../core/entities');
		const { EmployeeSettingSubscriber } = require('./employee-setting.subscriber');
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			synchronize: true,
			entities: coreEntities,
			// The subscriber the application registers, which serializes `data` to text on the embedded dialect.
			subscribers: [EmployeeSettingSubscriber],
			logging: false
		});
		await dataSource.initialize();
		// Only the setting row is needed; its tenant/employee rows are irrelevant to the transaction behaviour.
		await dataSource.query('PRAGMA foreign_keys = OFF');

		service = new EmployeeSettingService(dataSource.getRepository(EmployeeSetting) as never, {} as never);
	}, ENTITY_GRAPH_TIMEOUT);

	afterAll(async () => {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM "employee_setting"');
		await dataSource.query(
			`INSERT INTO "employee_setting" ("id", "tenantId", "employeeId", "data") VALUES (?, ?, ?, ?)`,
			[SETTING, TENANT, EMPLOYEE, JSON.stringify({ display_filters: { layout: 'list' } })]
		);
	});

	const storedData = async () => {
		const [row] = await dataSource.query(`SELECT "data" FROM "employee_setting" WHERE "id" = ?`, [SETTING]);
		return JSON.parse(row.data);
	};

	it(
		'keeps both changes of concurrent patches of different keys',
		async () => {
			const results = await Promise.allSettled([
				service.patchData(SETTING, {
					operations: [{ op: SET, path: ['sidebar_preferences', 'views', 'is_pinned'], value: true }]
				}),
				service.patchData(SETTING, {
					operations: [{ op: SET, path: ['home_preferences', 'my_stickies', 'is_enabled'], value: false }]
				}),
				service.patchData(SETTING, { operations: [{ op: SET, path: ['rich_filters'], value: {} }] })
			]);

			expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
			expect(await storedData()).toEqual({
				display_filters: { layout: 'list' },
				sidebar_preferences: { views: { is_pinned: true } },
				home_preferences: { my_stickies: { is_enabled: false } },
				rich_filters: {}
			});
		},
		ENTITY_GRAPH_TIMEOUT
	);

	it(
		'answers the patched setting with its data parsed',
		async () => {
			const patched = await service.patchData(SETTING, { operations: [{ op: SET, path: ['a'], value: 1 }] });

			expect(patched.data).toEqual({ display_filters: { layout: 'list' }, a: 1 });
		},
		ENTITY_GRAPH_TIMEOUT
	);
});
