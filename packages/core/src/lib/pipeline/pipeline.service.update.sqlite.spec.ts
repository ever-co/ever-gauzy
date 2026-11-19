import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import type { MikroORM } from '@mikro-orm/core';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { buildSchema, graphql } from 'graphql';
import type { DataSource } from 'typeorm';
import type { RequestContext as RequestContextType } from '../core/context/request-context';
import type { PipelineService } from './pipeline.service';

/**
 * An update that leaves `stages` out keeps the pipeline's stages and the deals filed in them; one that states a list
 * removes the stages it leaves out, and their deals with them; `stages: []` removes them all (ever-co/ever-gauzy#12097).
 *
 * **What is real here.** One SQLite database whose tables TypeORM created from the platform's mapping, foreign keys
 * enforced: the deals of a removed stage go through their `ON DELETE CASCADE`, and nothing in this file removes them.
 * The real `PipelineService` over its repositories and the TypeORM connection, with the nested ownership check it runs
 * before its transaction. Only the caller's tenant is stood in for.
 *
 * **Both transports.** The same database is also reached the way a client reaches it: a body run through the
 * validation pipe of `PUT /pipelines/:id` and `PipelineController.update`, and an `updatePipeline` mutation run
 * through the served schema into `PipelineResolver`. There the membership lookup behind the organization validator is
 * stood in for as well: it reads the caller's account, which this database does not hold.
 *
 * **Both ORM settings.** The cases run with the modules loaded under `DB_ORM=typeorm`, then under `DB_ORM=mikro-orm`.
 * Under MikroORM the service also holds a MikroORM repository on the same database, as the API wires it, and each
 * update still commits its one transaction through TypeORM: the API initialises TypeORM under both settings.
 */
const TIMEOUT = 10 * 60 * 1000;

const TENANT = '7e000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '7e000000-0000-4000-8000-0000000000f1';
const PIPELINE = '7e000000-0000-4000-8000-0000000000a1';
const CONTACTED = '7e000000-0000-4000-8000-0000000000b1';
const PROPOSAL = '7e000000-0000-4000-8000-0000000000b2';
const OTHER_PIPELINE = '7e000000-0000-4000-8000-0000000000a2';
const QUALIFIED = '7e000000-0000-4000-8000-0000000000b3';

const SCOPE = { tenantId: TENANT, organizationId: ORGANIZATION };

/** The schema the API serves: the committed snapshot, which CI keeps equal to the server's composition. */
const SCHEMA = buildSchema(readFileSync(join(__dirname, '..', 'graphql', 'schema', 'schema.graphql'), 'utf8'));

const UPDATE_PIPELINE = 'mutation Update($input: UpdatePipelineInput!) { updatePipeline(input: $input) { id name } }';

/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
async function insert(dataSource: DataSource, table: string, row: Record<string, unknown>): Promise<void> {
	const columns = (await dataSource.query(`PRAGMA table_info("${table}")`)) as Array<{
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}>;
	const values: Record<string, unknown> = { ...row };
	for (const column of columns) {
		const isFilled = column.name in values;
		const isOptional = !column.notnull || column.dflt_value !== null || column.pk === 1;
		if (isFilled || isOptional) {
			continue;
		}
		values[column.name] = placeholderOf(column.type);
	}
	const keys = Object.keys(values);
	const names = keys.map((key) => `"${key}"`).join(', ');
	const marks = keys.map(() => '?').join(', ');
	await dataSource.query(
		`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
		keys.map((key) => values[key])
	);
}

function placeholderOf(type: string): unknown {
	const lower = type.toLowerCase();
	if (/int|bool|numeric|decimal|real|float/.test(lower)) {
		return 0;
	}
	if (/date|time/.test(lower)) {
		return '2026-01-01 00:00:00';
	}
	return 'x';
}

/**
 * The pipeline "Trail partnerships", its stages Contacted and Proposal, and one deal in each stage; and a second
 * pipeline, "Retail partners", with its own stage and deal, which no update of the first may reach.
 */
async function seedPipelines(dataSource: DataSource): Promise<void> {
	await insert(dataSource, 'pipeline', { id: PIPELINE, ...SCOPE, name: 'Trail partnerships' });
	await insert(dataSource, 'pipeline_stage', {
		id: CONTACTED,
		...SCOPE,
		pipelineId: PIPELINE,
		name: 'Contacted',
		index: 1
	});
	await insert(dataSource, 'pipeline_stage', {
		id: PROPOSAL,
		...SCOPE,
		pipelineId: PIPELINE,
		name: 'Proposal',
		index: 2
	});
	await insert(dataSource, 'deal', {
		id: '7e000000-0000-4000-8000-0000000000c1',
		...SCOPE,
		stageId: CONTACTED,
		title: 'Cedar Ridge intro',
		probability: 2
	});
	await insert(dataSource, 'deal', {
		id: '7e000000-0000-4000-8000-0000000000c2',
		...SCOPE,
		stageId: PROPOSAL,
		title: 'Larchmont Trails renewal',
		probability: 4
	});
	await insert(dataSource, 'pipeline', { id: OTHER_PIPELINE, ...SCOPE, name: 'Retail partners' });
	await insert(dataSource, 'pipeline_stage', {
		id: QUALIFIED,
		...SCOPE,
		pipelineId: OTHER_PIPELINE,
		name: 'Qualified',
		index: 1
	});
	await insert(dataSource, 'deal', {
		id: '7e000000-0000-4000-8000-0000000000c3',
		...SCOPE,
		stageId: QUALIFIED,
		title: 'Harbor Mills pilot',
		probability: 3
	});
}

/** What the database holds once an update returned: the pipeline's name, its stages and the deals left in them. */
async function stored(dataSource: DataSource) {
	const [pipeline] = await dataSource.query('SELECT "name" FROM "pipeline" WHERE "id" = ?', [PIPELINE]);
	const stages = await dataSource.query(
		'SELECT "name" FROM "pipeline_stage" WHERE "pipelineId" = ? ORDER BY "index"',
		[PIPELINE]
	);
	const deals = await dataSource.query('SELECT "title" FROM "deal" WHERE "stageId" IN (?, ?) ORDER BY "title"', [
		CONTACTED,
		PROPOSAL
	]);

	return {
		pipeline: pipeline?.name,
		stages: stages.map((stage: { name: string }) => stage.name),
		deals: deals.map((deal: { title: string }) => deal.title)
	};
}

/** The second pipeline's stage and deal rows, whole, to be compared before and after an update of the first. */
async function otherPipelineRows(dataSource: DataSource) {
	const stages = await dataSource.query('SELECT * FROM "pipeline_stage" WHERE "pipelineId" = ?', [OTHER_PIPELINE]);
	const deals = await dataSource.query('SELECT * FROM "deal" WHERE "stageId" = ?', [QUALIFIED]);

	return { stages, deals };
}

/** Checks that the second pipeline's stage and deal rows are the ones read before the update. */
async function expectUntouched(dataSource: DataSource, before: Awaited<ReturnType<typeof otherPipelineRows>>) {
	expect(before.stages).toHaveLength(1);
	expect(before.deals).toHaveLength(1);
	expect(await otherPipelineRows(dataSource)).toEqual(before);
}

describe.each(['typeorm', 'mikro-orm'])('PipelineService.update on SQLite, with DB_ORM=%s', (ormSetting) => {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	const file = join(tmpdir(), `gauzy-pipeline-update-${ormSetting}-${process.pid}-${Date.now()}.sqlite3`);
	let dataSource: DataSource;
	let mikroOrm: MikroORM<BetterSqliteDriver> | undefined;
	let service: PipelineService;
	let RequestContext: typeof RequestContextType;
	let createService: () => PipelineService;
	/** The classes a request meets on its way to the service, as the modules loaded under this setting define them. */
	let transports: {
		PipelineController: typeof import('./pipeline.controller').PipelineController;
		PipelineResolver: typeof import('./pipeline.resolver').PipelineResolver;
		UpdatePipelineDTO: typeof import('./dto').UpdatePipelineDTO;
		ValidationPipe: typeof import('@nestjs/common').ValidationPipe;
		OrganizationBelongsToUserConstraint: typeof import('../shared/validators/constraints/organization-belongs-to-user.constraint').OrganizationBelongsToUserConstraint;
	};
	/** The transactions committed through TypeORM since the case began. */
	let typeOrmCommits = 0;

	beforeAll(async () => {
		process.env.DB_ORM = ormSetting;
		process.env.DB_TYPE = 'better-sqlite3';
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities') as typeof import('../core/entities');
			const typeorm = require('typeorm') as typeof import('typeorm');
			const entities = require('../core/entities/internal') as typeof import('../core/entities/internal');
			const { ConnectionEntityManager } =
				require('../database/connection-entity-manager') as typeof import('../database/connection-entity-manager');
			const { TypeOrmDealRepository } =
				require('../deal/repository/type-orm-deal.repository') as typeof import('../deal/repository/type-orm-deal.repository');
			const { TypeOrmUserRepository } =
				require('../user/repository/type-orm-user.repository') as typeof import('../user/repository/type-orm-user.repository');
			const { TypeOrmPipelineRepository } =
				require('./repository/type-orm-pipeline.repository') as typeof import('./repository/type-orm-pipeline.repository');
			const { MikroOrmPipelineRepository } =
				require('./repository/mikro-orm-pipeline.repository') as typeof import('./repository/mikro-orm-pipeline.repository');
			const pipelines = require('./pipeline.service') as typeof import('./pipeline.service');
			RequestContext = (
				require('../core/context/request-context') as typeof import('../core/context/request-context')
			).RequestContext;

			dataSource = new typeorm.DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true,
				// As the application configures it (TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR)
				invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
			});
			await dataSource.initialize();
			// TypeORM's better-sqlite3 driver turns them on when it connects; stated again because the cascade to the
			// deals is what the cases read.
			await dataSource.query('PRAGMA foreign_keys = ON');
			dataSource.subscribers.push({
				afterTransactionCommit: () => {
					typeOrmCommits += 1;
				}
			});
			await insert(dataSource, 'tenant', { id: TENANT, name: 'Northwind Studio' });
			await insert(dataSource, 'organization', {
				id: ORGANIZATION,
				tenantId: TENANT,
				name: 'Fabrikam Outdoor',
				currency: 'EUR'
			});

			// Under DB_ORM=typeorm the API configures MikroORM without a connection, so no MikroORM repository is
			// reachable; under DB_ORM=mikro-orm it connects to the same database, and so does this one.
			if (ormSetting === 'mikro-orm') {
				const { EntityCaseNamingStrategy } = require('@mikro-orm/core') as typeof import('@mikro-orm/core');
				const { MikroORM, BetterSqliteDriver } =
					require('@mikro-orm/better-sqlite') as typeof import('@mikro-orm/better-sqlite');
				const { SoftDeleteHandler } =
					require('mikro-orm-soft-delete') as typeof import('mikro-orm-soft-delete');
				const { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS } =
					require('@gauzy/config') as typeof import('@gauzy/config');
				mikroOrm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: file,
					entities: coreEntities,
					persistOnCreate: true,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					namingStrategy: EntityCaseNamingStrategy,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			}

			// The service of one request: under MikroORM each request reads through a context of its own.
			createService = () => {
				let mikroOrmRepository: InstanceType<typeof MikroOrmPipelineRepository> | undefined;
				if (mikroOrm) {
					mikroOrmRepository = new MikroOrmPipelineRepository(mikroOrm.em.fork(), entities.Pipeline);
				}
				return new pipelines.PipelineService(
					new TypeOrmPipelineRepository(dataSource.getRepository(entities.Pipeline)),
					mikroOrmRepository,
					new TypeOrmDealRepository(dataSource.getRepository(entities.Deal)),
					new TypeOrmUserRepository(dataSource.getRepository(entities.User)),
					new ConnectionEntityManager(dataSource.manager)
				);
			};
			service = createService();
			transports = {
				PipelineController: (require('./pipeline.controller') as typeof import('./pipeline.controller'))
					.PipelineController,
				PipelineResolver: (require('./pipeline.resolver') as typeof import('./pipeline.resolver'))
					.PipelineResolver,
				UpdatePipelineDTO: (require('./dto') as typeof import('./dto')).UpdatePipelineDTO,
				ValidationPipe: (require('@nestjs/common') as typeof import('@nestjs/common')).ValidationPipe,
				OrganizationBelongsToUserConstraint: (
					require('../shared/validators/constraints/organization-belongs-to-user.constraint') as typeof import('../shared/validators/constraints/organization-belongs-to-user.constraint')
				).OrganizationBelongsToUserConstraint
			};
		});
	}, TIMEOUT);

	afterAll(async () => {
		await mikroOrm?.close(true);
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		rmSync(file, { force: true });
		process.env.DB_ORM = previous.DB_ORM;
		process.env.DB_TYPE = previous.DB_TYPE;
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM "deal"');
		await dataSource.query('DELETE FROM "pipeline_stage"');
		await dataSource.query('DELETE FROM "pipeline"');
		await seedPipelines(dataSource);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		typeOrmCommits = 0;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('runs under the ORM setting it names, on a database that enforces the cascade from a stage to its deals', async () => {
		const [pragma] = await dataSource.query('PRAGMA foreign_keys');
		const dealKeys = await dataSource.query('PRAGMA foreign_key_list("deal")');

		expect(service.ormType).toBe(ormSetting);
		expect(Number(pragma.foreign_keys)).toBe(1);
		expect(dealKeys).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ table: 'pipeline_stage', from: 'stageId', on_delete: 'CASCADE' })
			])
		);
	});

	it('keeps both stages and their deals when the update states no stages', async () => {
		await service.update(PIPELINE, { name: 'Trail partnerships 2026', organizationId: ORGANIZATION });

		expect(await stored(dataSource)).toEqual({
			pipeline: 'Trail partnerships 2026',
			stages: ['Contacted', 'Proposal'],
			deals: ['Cedar Ridge intro', 'Larchmont Trails renewal']
		});
		expect(typeOrmCommits).toBe(1);
	});

	it('removes the stage the list leaves out, with its deal, and keeps the other', async () => {
		const otherPipeline = await otherPipelineRows(dataSource);

		await service.update(PIPELINE, {
			name: 'Trail partnerships',
			organizationId: ORGANIZATION,
			stages: [{ id: CONTACTED, name: 'Contacted' }]
		});

		expect(await stored(dataSource)).toEqual({
			pipeline: 'Trail partnerships',
			stages: ['Contacted'],
			deals: ['Cedar Ridge intro']
		});
		await expectUntouched(dataSource, otherPipeline);
		expect(typeOrmCommits).toBe(1);
	});

	it('removes every stage, and every deal in them, when the update states an empty list', async () => {
		const otherPipeline = await otherPipelineRows(dataSource);

		await service.update(PIPELINE, { name: 'Trail partnerships', organizationId: ORGANIZATION, stages: [] });

		expect(await stored(dataSource)).toEqual({ pipeline: 'Trail partnerships', stages: [], deals: [] });
		await expectUntouched(dataSource, otherPipeline);
		expect(typeOrmCommits).toBe(1);
	});

	describe('through PUT /pipelines/:id', () => {
		let checkOrganization: jest.SpyInstance;

		beforeEach(() => {
			const { OrganizationBelongsToUserConstraint } = transports;
			checkOrganization = jest
				.spyOn(OrganizationBelongsToUserConstraint.prototype, 'checkOrganizationExistence')
				.mockResolvedValue(true);
		});

		/** Runs one body through the route's own validation pipe and its handler, as Nest calls them. */
		async function putPipeline(body: object): Promise<void> {
			const { PipelineController, UpdatePipelineDTO, ValidationPipe } = transports;
			const pipes: unknown[] = Reflect.getMetadata(PIPES_METADATA, PipelineController.prototype.update) ?? [];
			const pipe = pipes.find((it) => it instanceof ValidationPipe) as InstanceType<typeof ValidationPipe>;
			const validated = await pipe.transform(body, {
				type: 'body',
				metatype: UpdatePipelineDTO,
				data: undefined
			});

			await new PipelineController(createService()).update(PIPELINE, validated);
		}

		it('keeps both stages and their deals when the body leaves stages out', async () => {
			await putPipeline({ organizationId: ORGANIZATION, name: 'Trail partnerships 2026' });

			expect(checkOrganization).toHaveBeenCalledWith(ORGANIZATION);
			expect(await stored(dataSource)).toEqual({
				pipeline: 'Trail partnerships 2026',
				stages: ['Contacted', 'Proposal'],
				deals: ['Cedar Ridge intro', 'Larchmont Trails renewal']
			});
			expect(typeOrmCommits).toBe(1);
		});

		it('removes every stage and every deal in them when the body states an empty list', async () => {
			const otherPipeline = await otherPipelineRows(dataSource);

			await putPipeline({ organizationId: ORGANIZATION, name: 'Trail partnerships', stages: [] });

			expect(checkOrganization).toHaveBeenCalledWith(ORGANIZATION);
			expect(await stored(dataSource)).toEqual({ pipeline: 'Trail partnerships', stages: [], deals: [] });
			await expectUntouched(dataSource, otherPipeline);
			expect(typeOrmCommits).toBe(1);
		});
	});

	describe('through the updatePipeline mutation', () => {
		/** Runs one mutation through the served schema, into the resolver of one request. */
		async function mutatePipeline(input: object): Promise<unknown> {
			const { PipelineResolver } = transports;
			const resolver = new PipelineResolver(createService());
			const result = await graphql({
				schema: SCHEMA,
				source: UPDATE_PIPELINE,
				variableValues: { input },
				rootValue: {
					updatePipeline: (args: { input: { id: string } }) => resolver.updatePipeline(args.input)
				}
			});

			expect(result.errors).toBeUndefined();
			return result.data;
		}

		it('keeps both stages and their deals when the input leaves stages out', async () => {
			const answer = await mutatePipeline({ id: PIPELINE, name: 'Trail partnerships 2026' });

			expect(answer).toEqual({ updatePipeline: { id: PIPELINE, name: 'Trail partnerships 2026' } });
			expect(await stored(dataSource)).toEqual({
				pipeline: 'Trail partnerships 2026',
				stages: ['Contacted', 'Proposal'],
				deals: ['Cedar Ridge intro', 'Larchmont Trails renewal']
			});
			expect(typeOrmCommits).toBe(1);
		});

		it('removes every stage and every deal in them when the input states an empty list', async () => {
			const otherPipeline = await otherPipelineRows(dataSource);

			const answer = await mutatePipeline({ id: PIPELINE, name: 'Trail partnerships', stages: [] });

			expect(answer).toEqual({ updatePipeline: { id: PIPELINE, name: 'Trail partnerships' } });
			expect(await stored(dataSource)).toEqual({ pipeline: 'Trail partnerships', stages: [], deals: [] });
			await expectUntouched(dataSource, otherPipeline);
			expect(typeOrmCommits).toBe(1);
		});
	});
});
