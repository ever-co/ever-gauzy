jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import * as dotenv from 'dotenv';
import '../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { ID, IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { knex as createKnex } from 'knex';
import { MultiORM, MultiORMEnum } from '../../core/utils';
import { ProfileActivityPeriod, resolveProfileActivityPeriod } from './profile-activity.helper';
import { StatisticService } from './statistic.service';

const TENANT_ID = '7d1c7e8d-a91a-4f58-a5ba-5aa4b7fb21fd';
const ORGANIZATION_ID = '7ad76e99-a28f-4a1a-b70b-31daab18f179';
const EMPLOYEE_ID = 'e6804e2f-4d20-4397-afd1-ef56d5d64899';
const TEAM_ID = '85e5ee75-5933-49db-b0fe-03bd8f560551';

const request: IGetProfileActivity = {
	organizationId: ORGANIZATION_ID,
	employeeId: EMPLOYEE_ID,
	organizationTeamId: TEAM_ID,
	startDate: '2026-08-01',
	endDate: '2026-08-03',
	timeZone: 'Europe/Madrid',
	includeDaily: true
};

const aggregateRows = [{ date: '2026-08-01', duration: '0.3' }];
const projectionRows = [
	{
		startedAt: '2026-08-01 00:00:00.000',
		stoppedAt: '2026-08-01 00:00:00.300'
	}
];

const expectedResponse: IProfileActivity = {
	employeeId: EMPLOYEE_ID,
	activeDays: 1,
	totalDuration: 0.3,
	firstActiveOn: '2026-08-01',
	lastActiveOn: '2026-08-01',
	period: {
		startDate: '2026-08-01',
		endDate: '2026-08-03',
		timeZone: 'Europe/Madrid'
	},
	daily: [{ date: '2026-08-01', duration: 0.3 }]
};

type Authorization = jest.Mock<Promise<ID>, [IGetProfileActivity]>;

class TestStatisticService extends StatisticService {
	constructor(
		typeOrmTimeLogRepository: any,
		mikroOrmTimeLogRepository: any,
		configService: any,
		private readonly authorize: Authorization
	) {
		super(
			{ createQueryBuilder: jest.fn() } as any,
			{ existsBy: jest.fn() } as any,
			{ createQueryBuilder: jest.fn() } as any,
			typeOrmTimeLogRepository,
			mikroOrmTimeLogRepository,
			{} as any,
			configService,
			{} as any
		);
	}

	setProfileOrm(orm: MultiORM | string): void {
		this.ormType = orm as MultiORM;
	}

	compileProfileActivityQuery(input: IGetProfileActivity, tenantId: ID, period: ProfileActivityPeriod): any {
		return this.buildProfileActivityRowsQuery(input, tenantId, period);
	}

	protected assertProfileActivityAccess(input: IGetProfileActivity): Promise<ID> {
		return this.authorize(input);
	}
}

function createTypeOrmBuilder(rows: unknown[] = projectionRows) {
	const builder: Record<string, jest.Mock> = {};
	for (const method of [
		'select',
		'addSelect',
		'where',
		'andWhere',
		'groupBy',
		'setParameter',
		'innerJoin',
		'leftJoin',
		'innerJoinAndSelect',
		'leftJoinAndSelect',
		'getMany'
	]) {
		builder[method] = jest.fn(() => builder);
	}
	builder.getRawMany = jest.fn().mockResolvedValue(rows);
	return builder;
}

function createKnexBuilder(rows: unknown[] = projectionRows) {
	let executionCount = 0;
	const builder: Record<string, any> = {};
	for (const method of [
		'select',
		'whereRaw',
		'groupByRaw',
		'innerJoin',
		'leftJoin',
		'join',
		'joinRaw',
		'first',
		'pluck'
	]) {
		builder[method] = jest.fn(() => builder);
	}
	builder.then = jest.fn((resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => {
		executionCount++;
		return Promise.resolve(rows).then(resolve, reject);
	});

	const knex: any = jest.fn(() => builder);
	knex.raw = jest.fn((sql: string, bindings?: unknown[]) => ({ sql, bindings }));

	return {
		builder,
		knex,
		get executionCount() {
			return executionCount;
		}
	};
}

function createService(options: {
	orm: MultiORM | string;
	dialect: DatabaseTypeEnum | string;
	typeOrmRows?: unknown[];
	knexRows?: unknown[];
	authorize?: Authorization;
}) {
	const typeOrmBuilder = createTypeOrmBuilder(options.typeOrmRows);
	const typeOrmTimeLogRepository = {
		createQueryBuilder: jest.fn(() => typeOrmBuilder)
	};
	const knexFixture = createKnexBuilder(options.knexRows);
	const mikroOrmTimeLogRepository = {
		getKnex: jest.fn(() => knexFixture.knex)
	};
	const authorize = options.authorize ?? jest.fn().mockResolvedValue(TENANT_ID);
	const service = new TestStatisticService(
		typeOrmTimeLogRepository,
		mikroOrmTimeLogRepository,
		{ dbConnectionOptions: { type: options.dialect } },
		authorize
	);
	service.setProfileOrm(options.orm);

	return {
		service,
		authorize,
		typeOrmTimeLogRepository,
		typeOrmBuilder,
		mikroOrmTimeLogRepository,
		builder: knexFixture.builder,
		knex: knexFixture.knex,
		getExecutionCount: () => knexFixture.executionCount
	};
}

function typeOrmSql(builder: Record<string, jest.Mock>): string {
	return ['select', 'addSelect', 'where', 'andWhere', 'groupBy']
		.flatMap((method) => builder[method].mock.calls)
		.map(([sql]) => sql)
		.filter((sql): sql is string => typeof sql === 'string')
		.join('\n');
}

function typeOrmParameters(builder: Record<string, jest.Mock>): Record<string, unknown> {
	return ['where', 'andWhere']
		.flatMap((method) => builder[method].mock.calls)
		.map(([, parameters]) => parameters)
		.filter(
			(parameters): parameters is Record<string, unknown> => parameters !== null && typeof parameters === 'object'
		)
		.reduce((all, parameters) => ({ ...all, ...parameters }), {});
}

function knexSql(fixture: ReturnType<typeof createService>): string {
	return [
		...fixture.knex.raw.mock.calls.map(([sql]) => sql),
		...fixture.builder.whereRaw.mock.calls.map(([sql]: [string]) => sql),
		...fixture.builder.groupByRaw.mock.calls.map(([sql]: [string]) => sql)
	].join('\n');
}

function knexBindings(fixture: ReturnType<typeof createService>): unknown[] {
	return [
		...fixture.knex.raw.mock.calls.flatMap(([, bindings]) => bindings ?? []),
		...fixture.builder.whereRaw.mock.calls.flatMap(([, bindings]) => bindings ?? []),
		...fixture.builder.groupByRaw.mock.calls.flatMap(([, bindings]) => bindings ?? [])
	];
}

function expectNoRelationOrHydrationCalls(builder: Record<string, jest.Mock>): void {
	for (const method of ['innerJoin', 'leftJoin', 'innerJoinAndSelect', 'leftJoinAndSelect', 'getMany']) {
		expect(builder[method]).not.toHaveBeenCalled();
	}
}

describe('profile activity query spec environment isolation', () => {
	it('hoists a no-op dotenv config mock before config, entity, and service imports', () => {
		expect(jest.isMockFunction(dotenv.config)).toBe(true);
		expect(dotenv.config).toHaveBeenCalled();
		expect(dotenv.config()).toEqual({ parsed: {} });
	});
});

describe('StatisticService profile activity query orchestration', () => {
	it('finishes authorization before creating a TypeORM time-log builder', async () => {
		let releaseAuthorization: (tenantId: ID) => void;
		const authorize: Authorization = jest.fn(
			(_input: IGetProfileActivity) => new Promise<ID>((resolve) => (releaseAuthorization = resolve))
		);
		const fixture = createService({
			orm: MultiORMEnum.TypeORM,
			dialect: DatabaseTypeEnum.betterSqlite3,
			authorize
		});

		const response = fixture.service.getProfileActivity(request);
		await Promise.resolve();

		expect(fixture.typeOrmTimeLogRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(fixture.mikroOrmTimeLogRepository.getKnex).not.toHaveBeenCalled();

		releaseAuthorization!(TENANT_ID);
		await expect(response).resolves.toEqual(expectedResponse);
		expect(fixture.typeOrmTimeLogRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
	});

	it('propagates authorization failures unchanged without creating either ORM builder', async () => {
		const failure = new Error('profile access unavailable');
		const authorize: Authorization = jest.fn().mockRejectedValue(failure);
		const fixture = createService({
			orm: MultiORMEnum.TypeORM,
			dialect: DatabaseTypeEnum.postgres,
			authorize
		});

		await expect(fixture.service.getProfileActivity(request)).rejects.toBe(failure);

		expect(fixture.typeOrmTimeLogRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(fixture.mikroOrmTimeLogRepository.getKnex).not.toHaveBeenCalled();
	});

	it('propagates a raw-select failure unchanged without retry or fallback', async () => {
		const failure = new Error('time-log database unavailable');
		const fixture = createService({
			orm: MultiORMEnum.TypeORM,
			dialect: DatabaseTypeEnum.betterSqlite3
		});
		fixture.typeOrmBuilder.getRawMany.mockRejectedValue(failure);

		await expect(fixture.service.getProfileActivity(request)).rejects.toBe(failure);

		expect(fixture.typeOrmBuilder.getRawMany).toHaveBeenCalledTimes(1);
		expect(fixture.mikroOrmTimeLogRepository.getKnex).not.toHaveBeenCalled();
	});
});

describe('StatisticService TypeORM profile activity query shape', () => {
	it.each([
		[DatabaseTypeEnum.mysql, 'CHAR'],
		[DatabaseTypeEnum.sqlite, 'TEXT'],
		[DatabaseTypeEnum.betterSqlite3, 'TEXT']
	])('uses one %s UTC-naive projection with the expected %s cast', async (dialect, castType) => {
		const fixture = createService({ orm: MultiORMEnum.TypeORM, dialect });

		await expect(fixture.service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

		const sql = typeOrmSql(fixture.typeOrmBuilder);
		const parameters = typeOrmParameters(fixture.typeOrmBuilder);
		expect(sql).toContain(`CAST(time_log.startedAt AS ${castType})`);
		expect(sql).toContain(`CAST(time_log.stoppedAt AS ${castType})`);
		expect(sql).not.toContain('TO_CHAR');
		expect(sql).not.toContain('EXTRACT(EPOCH');
		expect(sql).toContain('time_log.startedAt >= :profileStart');
		expect(sql).toContain('time_log.startedAt < :profileEnd');
		expect(parameters).toMatchObject({
			profileTenantId: TENANT_ID,
			profileOrganizationId: ORGANIZATION_ID,
			profileEmployeeId: EMPLOYEE_ID,
			profileStart: '2026-07-31 22:00:00.000',
			profileEnd: '2026-08-02 22:00:00.000'
		});
		expect(fixture.typeOrmBuilder.groupBy).not.toHaveBeenCalled();
		expect(fixture.typeOrmBuilder.getRawMany).toHaveBeenCalledTimes(1);
		expectNoRelationOrHydrationCalls(fixture.typeOrmBuilder);
	});

	it('uses one parameterized PostgreSQL aggregate and identical date grouping expression', async () => {
		const fixture = createService({
			orm: MultiORMEnum.TypeORM,
			dialect: DatabaseTypeEnum.postgres,
			typeOrmRows: aggregateRows
		});

		await expect(fixture.service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

		const sql = typeOrmSql(fixture.typeOrmBuilder);
		const parameters = typeOrmParameters(fixture.typeOrmBuilder);
		const expectedDateExpression =
			"TO_CHAR((time_log.startedAt AT TIME ZONE 'UTC') AT TIME ZONE :profileTimeZone, 'YYYY-MM-DD')";
		expect(fixture.typeOrmBuilder.select).toHaveBeenCalledWith(expectedDateExpression, 'date');
		expect(fixture.typeOrmBuilder.groupBy).toHaveBeenCalledWith(expectedDateExpression);
		expect(sql).toContain('SUM(EXTRACT(EPOCH FROM (time_log.stoppedAt - time_log.startedAt)))');
		expect(sql).toContain("time_log.startedAt >= (CAST(:profileStart AS timestamptz) AT TIME ZONE 'UTC')");
		expect(sql).toContain("time_log.startedAt < (CAST(:profileEnd AS timestamptz) AT TIME ZONE 'UTC')");
		expect(parameters).toMatchObject({
			profileTenantId: TENANT_ID,
			profileOrganizationId: ORGANIZATION_ID,
			profileEmployeeId: EMPLOYEE_ID,
			profileStart: '2026-07-31T22:00:00.000Z',
			profileEnd: '2026-08-02T22:00:00.000Z'
		});
		expect(fixture.typeOrmBuilder.setParameter).toHaveBeenCalledWith('profileTimeZone', 'Europe/Madrid');
		expect(sql).not.toContain(TENANT_ID);
		expect(sql).not.toContain(ORGANIZATION_ID);
		expect(sql).not.toContain(EMPLOYEE_ID);
		expect(sql).not.toContain('Europe/Madrid');
		expect(fixture.typeOrmBuilder.getRawMany).toHaveBeenCalledTimes(1);
		expectNoRelationOrHydrationCalls(fixture.typeOrmBuilder);
	});

	it.each(['America/Coyhaique', 'america/coyhaique'])(
		'uses the PostgreSQL text projection with PostgreSQL bounds for %s',
		async (timeZone) => {
			const coyhaiqueRequest = {
				...request,
				timeZone,
				startDate: '2026-01-01',
				endDate: '2026-01-02'
			};
			const fixture = createService({ orm: MultiORMEnum.TypeORM, dialect: DatabaseTypeEnum.postgres });

			await fixture.service.getProfileActivity(coyhaiqueRequest);

			const sql = typeOrmSql(fixture.typeOrmBuilder);
			expect(sql).toContain('CAST(time_log.startedAt AS TEXT)');
			expect(sql).toContain('CAST(time_log.stoppedAt AS TEXT)');
			expect(sql).not.toContain('TO_CHAR');
			expect(sql).not.toContain('EXTRACT(EPOCH');
			expect(sql).toContain("time_log.startedAt >= (CAST(:profileStart AS timestamptz) AT TIME ZONE 'UTC')");
			expect(fixture.typeOrmBuilder.groupBy).not.toHaveBeenCalled();
			expect(fixture.typeOrmBuilder.getRawMany).toHaveBeenCalledTimes(1);
		}
	);

	it('binds every shared predicate, excludes invalid durations, and never filters by team', async () => {
		const fixture = createService({
			orm: MultiORMEnum.TypeORM,
			dialect: DatabaseTypeEnum.betterSqlite3
		});

		await fixture.service.getProfileActivity(request);

		const sql = typeOrmSql(fixture.typeOrmBuilder);
		expect(sql).toContain('time_log.tenantId = :profileTenantId');
		expect(sql).toContain('time_log.organizationId = :profileOrganizationId');
		expect(sql).toContain('time_log.employeeId = :profileEmployeeId');
		expect(sql).toContain('time_log.stoppedAt IS NOT NULL');
		expect(sql).toContain('time_log.stoppedAt > time_log.startedAt');
		expect(sql).not.toContain('organizationTeamId');
		expect(sql).not.toContain(TEAM_ID);
	});
});

describe('StatisticService MikroORM/Knex profile activity query shape', () => {
	it('compiles PostgreSQL grouping by the selected date with one timezone parameter identity', async () => {
		const pgKnex = createKnex({ client: 'pg' });
		const queryEvents = jest.fn();
		pgKnex.on('query', queryEvents);
		const service = new TestStatisticService(
			{},
			{ getKnex: () => pgKnex },
			{ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } },
			jest.fn().mockResolvedValue(TENANT_ID)
		);
		service.setProfileOrm(MultiORMEnum.MikroORM);

		try {
			const compiledQuery = service.compileProfileActivityQuery(
				request,
				TENANT_ID,
				resolveProfileActivityPeriod(request)
			);
			const native = compiledQuery.builder.toSQL().toNative();
			const evidence = {
				nativeSql: native.sql,
				timezoneParameterPositions: native.bindings.flatMap((value: unknown, index: number) =>
					value === 'Europe/Madrid' ? [index] : []
				)
			};

			expect(evidence).toEqual({
				nativeSql: expect.stringMatching(/\bgroup by 1\b/i),
				timezoneParameterPositions: [0]
			});
			expect(queryEvents).not.toHaveBeenCalled();
		} finally {
			await pgKnex.destroy();
		}
	});

	it.each([
		[DatabaseTypeEnum.mysql, 'CHAR'],
		[DatabaseTypeEnum.sqlite, 'TEXT'],
		[DatabaseTypeEnum.betterSqlite3, 'TEXT']
	])('uses one %s UTC-naive projection with the expected %s cast', async (dialect, castType) => {
		const fixture = createService({ orm: MultiORMEnum.MikroORM, dialect });

		await expect(fixture.service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

		const sql = knexSql(fixture);
		const bindings = knexBindings(fixture);
		expect(sql).toContain(`CAST(?? AS ${castType}) AS ??`);
		expect(sql).not.toContain('TO_CHAR');
		expect(sql).not.toContain('EXTRACT(EPOCH');
		expect(sql).toContain('?? >= ?');
		expect(sql).toContain('?? < ?');
		expect(bindings).toEqual(
			expect.arrayContaining([
				'time_log.startedAt',
				'time_log.stoppedAt',
				TENANT_ID,
				ORGANIZATION_ID,
				EMPLOYEE_ID,
				'2026-07-31 22:00:00.000',
				'2026-08-02 22:00:00.000'
			])
		);
		expect(fixture.builder.groupByRaw).not.toHaveBeenCalled();
		expect(fixture.getExecutionCount()).toBe(1);
		expect(fixture.builder.then).toHaveBeenCalledTimes(1);
		expect(fixture.knex).toHaveBeenCalledTimes(1);
		expect(fixture.typeOrmTimeLogRepository.createQueryBuilder).not.toHaveBeenCalled();
		for (const method of ['innerJoin', 'leftJoin', 'join', 'joinRaw', 'first', 'pluck']) {
			expect(fixture.builder[method]).not.toHaveBeenCalled();
		}
	});

	it('uses one parameterized PostgreSQL aggregate with bound identifiers, values, and timezone', async () => {
		const fixture = createService({
			orm: MultiORMEnum.MikroORM,
			dialect: DatabaseTypeEnum.postgres,
			knexRows: aggregateRows
		});

		await expect(fixture.service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

		const sql = knexSql(fixture);
		const bindings = knexBindings(fixture);
		const dateSql = "TO_CHAR((?? AT TIME ZONE 'UTC') AT TIME ZONE ?, 'YYYY-MM-DD')";
		expect(fixture.knex.raw).toHaveBeenCalledWith(`${dateSql} AS ??`, [
			'time_log.startedAt',
			'Europe/Madrid',
			'date'
		]);
		expect(fixture.builder.groupByRaw).toHaveBeenCalledWith('1');
		expect(sql).toContain('SUM(EXTRACT(EPOCH FROM (?? - ??))) AS ??');
		expect(sql).toContain("?? >= (CAST(? AS timestamptz) AT TIME ZONE 'UTC')");
		expect(sql).toContain("?? < (CAST(? AS timestamptz) AT TIME ZONE 'UTC')");
		expect(bindings).toEqual(
			expect.arrayContaining([
				TENANT_ID,
				ORGANIZATION_ID,
				EMPLOYEE_ID,
				'Europe/Madrid',
				'2026-07-31T22:00:00.000Z',
				'2026-08-02T22:00:00.000Z'
			])
		);
		expect(sql).not.toContain(TENANT_ID);
		expect(sql).not.toContain(ORGANIZATION_ID);
		expect(sql).not.toContain(EMPLOYEE_ID);
		expect(sql).not.toContain('Europe/Madrid');
		expect(fixture.getExecutionCount()).toBe(1);
	});

	it.each(['America/Coyhaique', 'america/coyhaique'])(
		'uses the PostgreSQL text projection with PostgreSQL bounds for %s',
		async (timeZone) => {
			const coyhaiqueRequest = {
				...request,
				timeZone,
				startDate: '2026-01-01',
				endDate: '2026-01-02'
			};
			const fixture = createService({ orm: MultiORMEnum.MikroORM, dialect: DatabaseTypeEnum.postgres });

			await fixture.service.getProfileActivity(coyhaiqueRequest);

			const sql = knexSql(fixture);
			expect(sql).toContain('CAST(?? AS TEXT) AS ??');
			expect(sql).not.toContain('TO_CHAR');
			expect(sql).not.toContain('EXTRACT(EPOCH');
			expect(sql).toContain("?? >= (CAST(? AS timestamptz) AT TIME ZONE 'UTC')");
			expect(fixture.builder.groupByRaw).not.toHaveBeenCalled();
			expect(fixture.getExecutionCount()).toBe(1);
		}
	);

	it('binds every shared predicate, explicitly excludes deleted rows, and never filters by team', async () => {
		const fixture = createService({
			orm: MultiORMEnum.MikroORM,
			dialect: DatabaseTypeEnum.betterSqlite3
		});

		await fixture.service.getProfileActivity(request);

		const calls = fixture.builder.whereRaw.mock.calls;
		expect(calls).toEqual(
			expect.arrayContaining([
				['?? = ?', ['time_log.tenantId', TENANT_ID]],
				['?? = ?', ['time_log.organizationId', ORGANIZATION_ID]],
				['?? = ?', ['time_log.employeeId', EMPLOYEE_ID]],
				['?? IS NULL', ['time_log.deletedAt']],
				['?? IS NOT NULL', ['time_log.stoppedAt']],
				['?? > ??', ['time_log.stoppedAt', 'time_log.startedAt']]
			])
		);
		expect(knexBindings(fixture)).not.toContain('time_log.organizationTeamId');
		expect(knexBindings(fixture)).not.toContain(TEAM_ID);
	});
});

describe('StatisticService profile activity fail-closed selection', () => {
	it.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
		'rejects an unsupported dialect before creating a %s builder',
		async (orm) => {
			const fixture = createService({ orm, dialect: DatabaseTypeEnum.mongodb });

			await expect(fixture.service.getProfileActivity(request)).rejects.toThrow(
				'Unsupported profile activity database'
			);

			expect(fixture.typeOrmTimeLogRepository.createQueryBuilder).not.toHaveBeenCalled();
			expect(fixture.mikroOrmTimeLogRepository.getKnex).not.toHaveBeenCalled();
		}
	);

	it('rejects an unsupported ORM before creating either builder', async () => {
		const fixture = createService({ orm: 'unsupported-orm', dialect: DatabaseTypeEnum.postgres });

		await expect(fixture.service.getProfileActivity(request)).rejects.toThrow('Unsupported profile activity ORM');

		expect(fixture.typeOrmTimeLogRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(fixture.mikroOrmTimeLogRepository.getKnex).not.toHaveBeenCalled();
	});
});
