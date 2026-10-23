import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { EntityManager, EntityMetadata, MikroORM as MikroOrmInstance } from '@mikro-orm/core';
import type { IPagination } from '@gauzy/contracts';
import type { BaseQueryDTO } from '../../core/crud';

/**
 * One database holding a handful of projects linked to GitHub repositories, read through both ORMs — the store
 * `organization-project.synced.*.spec.ts` ask `OrganizationProjectService.findSyncedProjects` about.
 *
 * **What is real.** The entities are the platform's own (`coreEntities` and the GitHub plugin's two), imported
 * under `DB_ORM=mikro-orm`, with the GitHub plugin's custom fields on `OrganizationProject` registered through
 * the platform's own `registerTypeOrmCustomFields` / `registerMikroOrmCustomFields`: TypeORM's before its data
 * source is built, as `preBootstrapApplicationConfig` does, and MikroORM's either after MikroORM has discovered
 * the entities (where `bootstrap()` calls it today) or before. The tables are created from TypeORM's mapping, as
 * the migrations created them, in one SQLite file both ORMs open: MikroORM on
 * better-sqlite3 with the options the platform configures (`EntityCaseNamingStrategy`, the soft-delete
 * extension, `autoJoinRefsForFilters: false`). The service is the real `OrganizationProjectService`; its TypeORM
 * branch, run over the same rows, is the answer the MikroORM branch has to give.
 *
 * The plugin configuration is restated from `integration-github.plugin.ts` (and, on request, the two
 * many-to-many custom fields of `job-proposal.plugin.ts` and `job-search.plugin.ts`) rather than read from the
 * plugin classes, which would import their Nest modules.
 */

/** The ids the rows are seeded with. */
export const SYNCED_IDS = {
	/** The tenant of the credential every read is made with. */
	TENANT: '6a000000-0000-4000-8000-000000000001',
	OTHER_TENANT: '6a000000-0000-4000-8000-000000000002',
	ORGANIZATION: '6b000000-0000-4000-8000-000000000001',
	OTHER_ORGANIZATION: '6b000000-0000-4000-8000-000000000002',
	REPOSITORY: {
		/** The tenant's repository in the organization. */
		LIVE: '6c000000-0000-4000-8000-000000000001',
		/** A soft-deleted repository of the tenant. */
		DELETED: '6c000000-0000-4000-8000-000000000002',
		/** The tenant's repository in the other organization. */
		OTHER_ORGANIZATION: '6c000000-0000-4000-8000-000000000003',
		/** Another tenant's repository. */
		OTHER_TENANT: '6c000000-0000-4000-8000-000000000004'
	}
} as const;

/** The projects, by name: which repository each one links, and whose it is. */
const PROJECTS: ReadonlyArray<{
	name: string;
	tenantId: string;
	organizationId: string;
	repositoryId: string | null;
	deleted?: boolean;
}> = [
	{
		name: 'a linked',
		tenantId: SYNCED_IDS.TENANT,
		organizationId: SYNCED_IDS.ORGANIZATION,
		repositoryId: SYNCED_IDS.REPOSITORY.LIVE
	},
	{ name: 'b not linked', tenantId: SYNCED_IDS.TENANT, organizationId: SYNCED_IDS.ORGANIZATION, repositoryId: null },
	{
		name: 'c linked to a deleted repository',
		tenantId: SYNCED_IDS.TENANT,
		organizationId: SYNCED_IDS.ORGANIZATION,
		repositoryId: SYNCED_IDS.REPOSITORY.DELETED
	},
	{
		name: 'd linked, other organization',
		tenantId: SYNCED_IDS.TENANT,
		organizationId: SYNCED_IDS.OTHER_ORGANIZATION,
		repositoryId: SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION
	},
	{
		name: "e linked to the other organization's repository",
		tenantId: SYNCED_IDS.TENANT,
		organizationId: SYNCED_IDS.ORGANIZATION,
		repositoryId: SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION
	},
	{
		name: 'f other tenant',
		tenantId: SYNCED_IDS.OTHER_TENANT,
		organizationId: SYNCED_IDS.ORGANIZATION,
		repositoryId: SYNCED_IDS.REPOSITORY.OTHER_TENANT
	},
	{
		name: "g linked to another tenant's repository",
		tenantId: SYNCED_IDS.TENANT,
		organizationId: SYNCED_IDS.ORGANIZATION,
		repositoryId: SYNCED_IDS.REPOSITORY.OTHER_TENANT
	},
	{
		name: 'h deleted',
		tenantId: SYNCED_IDS.TENANT,
		organizationId: SYNCED_IDS.ORGANIZATION,
		repositoryId: SYNCED_IDS.REPOSITORY.LIVE,
		deleted: true
	}
];

/** `findSyncedProjects`, as one ORM's branch of the service answers it. */
export interface ISyncedProjectsReader {
	findSyncedProjects(options?: Partial<BaseQueryDTO<any>>): Promise<IPagination<any>>;
}

export interface ISyncedProjectsStore {
	/** The service, on MikroORM (the process runs `DB_ORM=mikro-orm`). */
	mikroOrm: ISyncedProjectsReader;
	/** The same service instance's TypeORM branch, over the same rows. */
	typeOrm: ISyncedProjectsReader;
	/** MikroORM's metadata of `OrganizationProject`. */
	metadata: EntityMetadata;
	/** A fresh MikroORM context. */
	em(): EntityManager;
	close(): Promise<void>;
}

export interface ISyncedProjectsStoreOptions {
	/** When `registerMikroOrmCustomFields` runs relative to MikroORM discovering the entities. */
	registerMikroOrmCustomFields: 'after-discovery' | 'before-discovery';
	/** Also declare the job plugins' many-to-many custom fields on `Tag` and `Employee`, and their entities. */
	withManyToManyCustomFields?: boolean;
}

const PLUGINS = '../../../../../plugins';

/**
 * Opens the store. Rejects with MikroORM's own error when MikroORM refuses the mapping it is given.
 */
export async function openSyncedProjectsStore(options: ISyncedProjectsStoreOptions): Promise<ISyncedProjectsStore> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const file = path.join(os.tmpdir(), `gauzy-synced-projects-${process.pid}-${Date.now()}.sqlite`);
	let store: ISyncedProjectsStore | undefined;

	try {
		await jest.isolateModulesAsync(async () => {
			const { MikroORM, EntityCaseNamingStrategy, MetadataStorage } = require('@mikro-orm/core');
			// MikroORM's decorator storage is global to the test file: start from the classes imported below only.
			MetadataStorage.clear();
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { DataSource } = require('typeorm');
			const { defineConfig } = require('@gauzy/config');
			const { coreEntities } = require('../../core/entities');
			const {
				registerMikroOrmCustomFields,
				registerTypeOrmCustomFields
			} = require('../../core/entities/custom-entity-fields');
			const { RequestContext } = require('../../core/context');
			const { OrganizationProject } = require('../organization-project.entity');
			const { OrganizationProjectService } = require('../organization-project.service');
			const { OrganizationGithubRepository } = require(
				`${PLUGINS}/integration-github/src/lib/github/repository/github-repository.entity`
			);
			const { OrganizationGithubRepositoryIssue } = require(
				`${PLUGINS}/integration-github/src/lib/github/repository/issue/github-repository-issue.entity`
			);

			const entities: unknown[] = [
				...coreEntities,
				OrganizationGithubRepository,
				OrganizationGithubRepositoryIssue
			];
			const customFields: Record<string, unknown[]> = {
				Employee: [],
				Tag: [],
				// integration-github.plugin.ts
				OrganizationProject: [
					{
						name: 'repository',
						type: 'relation',
						relationType: 'many-to-one',
						entity: OrganizationGithubRepository,
						nullable: true,
						onDelete: 'SET NULL'
					},
					{
						name: 'repositoryId',
						type: 'string',
						relation: 'repository',
						nullable: true,
						relationId: true,
						index: true
					}
				]
			};

			if (options.withManyToManyCustomFields) {
				const { Proposal } = require(`${PLUGINS}/job-proposal/src/lib/proposal/proposal.entity`);
				const { EmployeeProposalTemplate } = require(
					`${PLUGINS}/job-proposal/src/lib/proposal-template/employee-proposal-template.entity`
				);
				const { entities: jobSearchEntities } = require(
					`${PLUGINS}/job-search/src/lib/employee-job-preset/employee-job-preset.module`
				);
				const { JobPreset } = require(`${PLUGINS}/job-search/src/lib/employee-job-preset/job-preset.entity`);
				entities.push(Proposal, EmployeeProposalTemplate, ...jobSearchEntities);
				// job-proposal.plugin.ts
				customFields['Tag'].push({
					name: 'proposals',
					type: 'relation',
					relationType: 'many-to-many',
					pivotTable: 'tag_proposal',
					joinColumn: 'proposalId',
					inverseJoinColumn: 'tagId',
					entity: Proposal,
					inverseSide: (it: { tags: unknown }) => it.tags
				});
				// job-search.plugin.ts
				customFields['Employee'].push({
					name: 'jobPresets',
					type: 'relation',
					relationType: 'many-to-many',
					pivotTable: 'employee_job_preset',
					joinColumn: 'jobPresetId',
					inverseJoinColumn: 'employeeId',
					entity: JobPreset,
					inverseSide: (it: { employees: unknown }) => it.employees
				});
			}

			const config = { dbConnectionOptions: { type: 'better-sqlite3' }, customFields };
			// The TypeORM branch asks the configuration whether a plugin declared the `repository` field.
			await defineConfig({ customFields } as never);

			// As `preBootstrapApplicationConfig` does, before any data source is built.
			await registerTypeOrmCustomFields(config);
			if (options.registerMikroOrmCustomFields === 'before-discovery') {
				await registerMikroOrmCustomFields(config);
			}

			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities,
				synchronize: false,
				logging: false
			});
			await dataSource.initialize();

			let orm: MikroOrmInstance;
			try {
				// The tables as TypeORM's mapping (and so the migrations) created them. All of them: a MikroORM read
				// of a project also joins the relations the mapping loads eagerly (`image_asset`).
				await dataSource.synchronize();

				orm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: file,
					entities,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: false,
					namingStrategy: EntityCaseNamingStrategy,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			} catch (error) {
				await dataSource.destroy();
				throw error;
			}

			if (options.registerMikroOrmCustomFields === 'after-discovery') {
				// Where `bootstrap()` registers them today: after the Nest application, and so MikroORM, was created.
				await registerMikroOrmCustomFields(config);
			}

			await seed(orm.em.getConnection());

			const tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(SYNCED_IDS.TENANT);

			// The service's collaborators play no part in this read; its two repositories are the whole of its state.
			const service = Object.create(OrganizationProjectService.prototype);
			Object.defineProperty(service, 'typeOrmRepository', {
				value: dataSource.getRepository(OrganizationProject)
			});
			Object.defineProperty(service, 'mikroOrmRepository', {
				get: () => orm.em.fork().getRepository(OrganizationProject)
			});
			const typeOrm = Object.create(service);
			Object.defineProperty(typeOrm, 'ormType', { value: 'typeorm' });

			store = {
				mikroOrm: service,
				typeOrm,
				metadata: orm.getMetadata().get('OrganizationProject'),
				em: () => orm.em.fork(),
				close: async () => {
					tenant.mockRestore();
					await orm.close(true);
					await dataSource.destroy();
				}
			};
		});
	} catch (error) {
		removeFile(file);
		throw error;
	} finally {
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
	}

	const opened = store as ISyncedProjectsStore;
	return {
		...opened,
		close: async () => {
			await opened.close();
			removeFile(file);
		}
	};
}

/** The repositories and the projects, written straight to the tables. */
async function seed(connection: { execute(sql: string, params?: unknown[]): Promise<unknown> }): Promise<void> {
	await connection.execute('PRAGMA foreign_keys = OFF');

	const repositories: Array<[string, string, string, boolean]> = [
		[SYNCED_IDS.REPOSITORY.LIVE, SYNCED_IDS.TENANT, SYNCED_IDS.ORGANIZATION, false],
		[SYNCED_IDS.REPOSITORY.DELETED, SYNCED_IDS.TENANT, SYNCED_IDS.ORGANIZATION, true],
		[SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION, SYNCED_IDS.TENANT, SYNCED_IDS.OTHER_ORGANIZATION, false],
		[SYNCED_IDS.REPOSITORY.OTHER_TENANT, SYNCED_IDS.OTHER_TENANT, SYNCED_IDS.ORGANIZATION, false]
	];
	for (const [id, tenantId, organizationId, deleted] of repositories) {
		await connection.execute(
			`INSERT INTO organization_github_repository
				(id, tenantId, organizationId, repositoryId, name, fullName, owner, isActive, isArchived, hasSyncEnabled, deletedAt)
			VALUES (?, ?, ?, 42, 'repository', 'owner/repository', 'owner', 1, 0, 1, ${deleted ? "datetime('now')" : 'NULL'})`,
			[id, tenantId, organizationId]
		);
	}

	let sequence = 0;
	for (const project of PROJECTS) {
		sequence += 1;
		await connection.execute(
			`INSERT INTO organization_project (id, tenantId, organizationId, name, repositoryId, isActive, isArchived, deletedAt)
			VALUES (?, ?, ?, ?, ?, 1, 0, ${project.deleted ? "datetime('now')" : 'NULL'})`,
			[
				`6d000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
				project.tenantId,
				project.organizationId,
				project.name,
				project.repositoryId
			]
		);
	}
}

function removeFile(file: string): void {
	for (const candidate of [file, `${file}-wal`, `${file}-shm`]) {
		try {
			fs.rmSync(candidate, { force: true });
		} catch {
			// A file still held open by a driver that failed to close is left to the OS temp sweep.
		}
	}
}
