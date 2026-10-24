import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IsNull, Repository } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as csv from 'csv-parser';
import * as path from 'node:path';
import * as chalk from 'chalk';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/knex';
import { ID } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { convertToDatetime, getORMType, MultiORMEnum } from '../../core/utils';
import { FileStorage } from '../../core/file-storage';
import { Organization } from '../../core/entities/internal';
import { RequestContext } from '../../core/context';
import {
	isInstallationOperator,
	isOperatorOnlyTenantSetting,
	keepingOperatorOnlySettings
} from '../../tenant/tenant-setting/operator-only-tenant-settings';
import { fromSpreadsheetSafeCsvRow } from '../spreadsheet-safe-row';
import { usesSpreadsheetSafeCells } from '../export-manifest';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { extractImportArchive } from './import-archive-extract';
import { ImportRecordFindOrFailCommand, ImportRecordUpdateOrCreateCommand } from '../import-record';
import {
	mikroOrmClosureRebuildRunner,
	PRODUCT_CATEGORY_TABLE,
	ProductCategoryClosureRebuild,
	typeOrmClosureRebuildRunner
} from './product-category-closure-rebuild';
import {
	IColumnRelationMetadata,
	IForeignKey,
	IRepositoryModel,
	RepositoriesService
} from '../repositories/repositories.service';

/**
 * The column a row of a shared table the platform seeds is recognized by in another instance's archive, where its id is
 * not this instance's (see {@link ImportService.findSharedRow}).
 */
const SHARED_TABLE_NATURAL_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
	country: ['isoCode'],
	currency: ['isoCode'],
	feature: ['code'],
	language: ['code'],
	report: ['slug'],
	report_category: ['name']
});

/** The table of the tenant's settings, some of whose rows only the installation operator may write. */
const TENANT_SETTING_TABLE = 'tenant_setting';

/** A UUID, the only id a shared table's row can have: anything else is not looked up as an id. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ImportService {
	private readonly logger = new Logger(ImportService.name);

	/**
	 * The export/import repository graph, built once.
	 *
	 * Derived from `RepositoriesService`'s module-init state, never from the request, so a single
	 * shared copy is correct. The per-request state that used to live beside it — `_dirname` and
	 * `_extractPath` — is not, and is threaded explicitly instead (see {@link createExtractDirectory}).
	 */
	private repositories: Promise<IRepositoryModel[]> | null = null;

	constructor(private readonly commandBus: CommandBus, private repositoriesService: RepositoriesService) {}

	/**
	 * Builds (once) and returns the repository graph to import into.
	 */
	private async getRepositories(): Promise<IRepositoryModel[]> {
		if (!this.repositories) {
			// Do not cache a rejection: a transient failure must not poison every later request.
			this.repositories = this.repositoriesService.buildRepositoriesRelationsGraph().catch((error) => {
				this.repositories = null;
				throw error;
			});
		}
		return this.repositories;
	}

	/**
	 * Creates a private, per-request directory to extract an uploaded archive into.
	 *
	 * 🛑 Two defects are closed here. Every import used to extract into ONE fixed directory,
	 * `<assetPublicPath>/import/csv`, derived from a field on this singleton service — so two
	 * tenants importing at the same time read each other's CSVs, and tenant A's import inserted
	 * tenant B's rows under tenant A's id (GHSA-g235-c4fm-4fc7). That directory is also served
	 * unauthenticated by `ServeStaticModule` at `/public/`, so `GET /public/import/csv/user.csv`
	 * returned the business data of whoever was importing — permanently, after any import that threw
	 * before the cleanup step. `os.tmpdir()` is outside the served tree and unique per call.
	 *
	 * @returns Absolute path of the new, empty extraction directory.
	 */
	public async createExtractDirectory(): Promise<string> {
		// `mkdtemp` creates the directory owner-only (0700) on POSIX, so other local users of a shared
		// `/tmp` cannot read the extracted CSVs; the controller removes it in a `finally`.
		return await fsp.mkdtemp(path.join(os.tmpdir(), 'gauzy-import-'));
	}

	/**
	 * Removes one request's extraction directory. Best effort; never throws.
	 *
	 * @param extractPath - The directory returned by {@link createExtractDirectory}.
	 */
	public async removeExtractedFiles(extractPath: string): Promise<void> {
		// Refuse an empty path outright rather than turning a recursive delete loose on a default.
		if (!extractPath || typeof extractPath !== 'string') {
			return;
		}
		try {
			await fsp.rm(extractPath, { recursive: true, force: true });
		} catch (error) {
			this.logger.error(`Failed to remove import extraction directory ${extractPath}`, error?.stack);
		}
	}

	/**
	 * Extracts the uploaded archive into this request's own directory, then imports it.
	 *
	 * @param extractPath - This request's extraction directory.
	 * @param filePath - Storage key of the uploaded archive.
	 * @param cleanup - Whether to wipe the tenant's existing rows first (`ImportTypeEnum.CLEAN`).
	 */
	public async unzipAndParse(extractPath: string, filePath: string, cleanup: boolean = false) {
		const file = await new FileStorage().getProvider().getFile(filePath);
		await extractImportArchive(file, extractPath);
		await this.parse(extractPath, cleanup);
	}

	async parse(extractPath: string, cleanup: boolean = false) {
		/**
		 * Can only run in a particular order
		 */
		const tenantId = RequestContext.currentTenantId();
		const repositories = await this.getRepositories();
		// Only an archive this server wrote carries the escape, so only such an archive is decoded: a
		// legacy dump, a filled-in `/export/template` or an externally built CSV set would otherwise
		// lose a legitimate leading apostrophe from a value such as `'=notes` (GHSA-7xp5-j564-4752).
		const decodeCells = await usesSpreadsheetSafeCells(extractPath);
		const junctionOwners: IRepositoryModel[] = [];
		for await (const item of repositories) {
			const { repository, isStatic = false, relations = [] } = item;
			const nameFile = repository.metadata.tableName;
			const csvPath = path.join(extractPath, `${nameFile}.csv`);
			const masterTable = repository.metadata.tableName;

			if (!fs.existsSync(csvPath)) {
				console.log(chalk.yellow(`File Does Not Exist, Skipping: ${nameFile}`));
				continue;
			}

			console.log(chalk.magenta(`Importing process start for table: ${masterTable}`));

			await new Promise(async (resolve, reject) => {
				try {
					/**
					 * This will first collect all the data and then insert
					 * If cleanup flag is set then it will also delete current tenant related data from the database table with CASCADE
					 */
					if (cleanup && isStatic !== true && !this.isSharedTable(item)) {
						try {
							if (masterTable === TENANT_SETTING_TABLE) {
								await this.cleanUpTenantSettings(repository, tenantId);
							} else {
								let sql = `DELETE FROM "${masterTable}" WHERE "${masterTable}"."tenantId" = '${tenantId}'`;
								await repository.query(sql);
							}
							console.log(chalk.yellow(`Clean up processing for table: ${masterTable}`));
						} catch (error) {
							console.log(chalk.red(`Failed to clean up process for table: ${masterTable}`), error);
							reject(error);
						}
					}

					let results = [];
					const stream = fs.createReadStream(csvPath, 'utf8').pipe(csv());
					stream.on('data', (data) => {
						// Undo the spreadsheet formula escape the export adds (GHSA-7xp5-j564-4752).
						results.push(decodeCells ? fromSpreadsheetSafeCsvRow(data) : data);
					});
					stream.on('error', (error) => {
						console.log(chalk.red(`Failed to parse CSV for table: ${masterTable}`), error);
						reject(error);
					});
					stream.on('end', async () => {
						results = results.filter(isNotEmpty);
						try {
							for await (const data of results) {
								if (isNotEmpty(data) && (await this.mayImportRow(item, data))) {
									await this.migrateImportEntityRecord(item, data);
								}
							}
							console.log(chalk.green(`Success to inserts data for table: ${masterTable}`));
						} catch (error) {
							console.log(chalk.red(`Failed to inserts data for table: ${masterTable}`), error);
							reject(error);
						}
						resolve(true);
					});
				} catch (error) {
					console.log(chalk.red(`Failed to read file for table: ${masterTable}`), error);
					reject(error);
				}
			});

			// The category tree's closure is derived from `parentId`, and the rows above were written
			// without it — see `rebuildProductCategoryClosure`.
			if (masterTable === PRODUCT_CATEGORY_TABLE) {
				await this.rebuildProductCategoryClosure(tenantId);
			}

			// A shared table's own junctions (the integration catalogue's types, ...) are shared too: never written.
			if (isNotEmpty(relations) && !this.isSharedTable(item)) {
				junctionOwners.push(item);
			}
		}

		// A junction row links two master tables, so both must be imported first: `tag_task` names
		// tags, and tags are imported after tasks.
		for (const item of junctionOwners) {
			await this.parseRelationalTables(extractPath, item, cleanup, decodeCells);
		}
	}

	/**
	 * Imports the junction tables of one entity.
	 *
	 * Each row is written between the destination ids of its two ends. A row with an end that was not
	 * imported for the tenant is skipped. Run it once every master table is imported.
	 *
	 * @param extractPath - This request's extraction directory.
	 * @param entity - The entity whose junction tables to read.
	 * @param cleanup - Whether the tenant's existing rows were wiped first.
	 * @param decodeCells - Whether the archive is a marked Gauzy export whose cells carry the
	 * spreadsheet-formula escape. Resolved from the archive manifest when the caller does not say.
	 */
	async parseRelationalTables(
		extractPath: string,
		entity: IRepositoryModel,
		cleanup: boolean = false,
		decodeCells?: boolean
	) {
		const decode = decodeCells ?? (await usesSpreadsheetSafeCells(extractPath));
		const { relations } = entity;
		for await (const item of relations) {
			const { joinTableName } = item;
			const csvPath = path.join(extractPath, `${joinTableName}.csv`);

			if (!fs.existsSync(csvPath)) {
				console.log(chalk.yellow(`File Does Not Exist, Skipping: ${joinTableName}`));
				continue;
			}

			console.log(chalk.magenta(`Importing process start for table: ${joinTableName}`));

			await new Promise(async (resolve, reject) => {
				try {
					let results = [];
					const stream = fs.createReadStream(csvPath, 'utf8').pipe(csv());
					stream.on('data', (data) => {
						// Undo the spreadsheet formula escape the export adds (GHSA-7xp5-j564-4752).
						results.push(decode ? fromSpreadsheetSafeCsvRow(data) : data);
					});
					stream.on('error', (error) => {
						console.log(chalk.red(`Failed to parse CSV for table: ${joinTableName}`), error);
						reject(error);
					});
					stream.on('end', async () => {
						results = results.filter(isNotEmpty);

						// `orIgnore` hides whether a pair was new, so the count is of rows linked, new or already there.
						let linked = 0;
						let skipped = 0;
						for await (const data of results) {
							try {
								if (isNotEmpty(data)) {
									const fields = await this.mapRelationFields(item, data);
									const row = Object.fromEntries(
										item.foreignKeys.map(({ column }) => [column, fields[column]])
									);
									// An end with no import record for this tenant maps to undefined: nothing to link.
									if (item.foreignKeys.some(({ column }) => !isNotEmpty(row[column]))) {
										skipped++;
										continue;
									}
									// `orIgnore` lets a merge re-import of the same archive pass the composite primary key.
									await entity.repository.manager
										.createQueryBuilder()
										.insert()
										.into(joinTableName)
										.values(row)
										.orIgnore()
										.execute();
									linked++;
								}
							} catch (error) {
								console.log(chalk.red(`Failed to inserts data for table: ${joinTableName}`), error);
								return reject(error);
							}
						}
						this.logger.log(
							`Imported junction table ${joinTableName}: ${linked} rows linked (new or already present), ${skipped} skipped with an end not imported`
						);
						resolve(true);
					});
				} catch (error) {
					console.log(chalk.red(`Failed to read file for table: ${joinTableName}`, error));
					reject(error);
				}
			});
		}
	}

	/**
	 * Rebuilds the importing tenant's category-tree closure, once `product_category` is imported.
	 *
	 * The rows reach the table through the generic path above — one repository write per CSV row — and
	 * never through `ProductCategoryService`, which is what keeps `product_category_closure` in step with
	 * `parentId` on every other write. So an imported category had no pair naming its parent or any
	 * ancestor: at most its self-pair, where TypeORM's closure executor wrote the row (it reads the `parent`
	 * relation, never `parentId`), and not even that where no ORM closure strategy did. Every descendant
	 * read, and the cycle guard that reads the same pairs, saw each imported category as a tree of one,
	 * and a re-import that moved a category left the pairs of its old ancestors behind.
	 *
	 * The tenant's pairs are therefore derived again from `parentId` — the level-by-level rebuild of
	 * `1791000000555`, narrowed to this tenant (see {@link ProductCategoryClosureRebuild}) — in one
	 * transaction on the active ORM's own manager, so no tree read sees the pairs half-written and a
	 * failure leaves the previous pairs in place.
	 *
	 * @param tenantId The importing tenant.
	 */
	public async rebuildProductCategoryClosure(tenantId: ID | null): Promise<void> {
		if (getORMType() === MultiORMEnum.MikroORM) {
			const em = this.repositoriesService.mikroOrmProductCategoryRepository.getEntityManager() as MikroOrmEntityManager;

			await em.transactional((transactional) =>
				new ProductCategoryClosureRebuild(
					mikroOrmClosureRebuildRunner(transactional as MikroOrmEntityManager)
				).rebuild(tenantId)
			);

			return;
		}

		await this.repositoriesService.typeOrmProductCategoryRepository.manager.transaction((manager) =>
			new ProductCategoryClosureRebuild(typeOrmClosureRebuildRunner(manager)).rebuild(tenantId)
		);
	}

	/*
	 * Map static tables import record before insert data
	 */
	async migrateImportEntityRecord(item: IRepositoryModel, entity: any): Promise<any> {
		const { repository } = item;
		const masterTable = repository.metadata.tableName;

		return await new Promise(async (resolve, reject) => {
			try {
				const source = JSON.parse(JSON.stringify(entity));
				// The lookup reads the mapped row: the archive's tenant and foreign keys are the source ids.
				const mapped = await this.mapFields(item, entity);
				// A shared table's row is never written: its id is only mapped to the row that already exists.
				const destination = this.isSharedTable(item)
					? await this.findSharedRow(item, mapped, source.id)
					: await this.commandBus.execute(
							new ImportEntityFieldMapOrCreateCommand(
								repository,
								this.uniqueKeyConditions(item, mapped),
								mapped,
								source.id
							)
						);
				if (destination) {
					await this.mappedImportRecord(item, destination, source);
				}
				resolve(true);
			} catch (error) {
				console.log(chalk.red(`Failed to migrate import entity data for table: ${masterTable}`), error, entity);
				reject(error);
			}
		});
	}

	/**
	 * Whether an archive row may be written. A `tenant_setting` row only the installation operator may write
	 * (`operator-only-tenant-settings.ts`: an organization's Documents storage limit) is skipped for anyone else, as
	 * `POST /tenant-setting/dynamic` refuses it: an archive must not set or lift the limit.
	 *
	 * The row it would be written over counts too. An archive row whose id an earlier import mapped is saved over that
	 * row ({@link ImportEntityFieldMapOrCreateCommand}), name included, so an ordinary name on the source id of an
	 * imported limit row renamed the limit away, and Documents fell back to the deployment default, which may be no
	 * limit at all.
	 *
	 * @param item - The table being imported.
	 * @param row - The archive row, as read (its `id` is still the archive's).
	 */
	private async mayImportRow(item: IRepositoryModel, row: Record<string, unknown>): Promise<boolean> {
		if (item.repository.metadata.tableName !== TENANT_SETTING_TABLE || isInstallationOperator()) {
			return true;
		}
		if (isOperatorOnlyTenantSetting(row?.['name'])) {
			this.logger.warn(
				`Skipped the tenant setting ${String(row['name'])}: only the installation's operator sets it.`
			);
			return false;
		}
		const overwritten = await this.importedDestinationName(item.repository, row?.['id']);
		if (isOperatorOnlyTenantSetting(overwritten)) {
			this.logger.warn(
				`Skipped the tenant setting ${String(row['name'])}: an earlier import mapped it to ${String(
					overwritten
				)}, which only the installation's operator sets.`
			);
			return false;
		}
		return true;
	}

	/**
	 * The name of the `tenant_setting` row an earlier import of this tenant mapped an archive id to, which is the row
	 * that archive row would be saved over, or `undefined` when the id was never imported.
	 *
	 * @param repository - The `tenant_setting` repository.
	 * @param sourceId - The row's id in the archive.
	 */
	private async importedDestinationName(repository: Repository<any>, sourceId: unknown): Promise<unknown> {
		if (!isNotEmpty(sourceId)) {
			return undefined;
		}
		let destinationId: ID | undefined;
		try {
			const found = await this.commandBus.execute(
				new ImportRecordFindOrFailCommand({
					tenantId: RequestContext.currentTenantId(),
					sourceId: sourceId as ID,
					entityType: TENANT_SETTING_TABLE
				})
			);
			destinationId = found?.success ? found.record?.destinationId : undefined;
		} catch {
			// No import record: the import creates a new row rather than saving over one.
			return undefined;
		}
		if (!destinationId) {
			return undefined;
		}
		// Trashed rows too: the save reaches the row by its id whether or not it is soft-deleted.
		const destination = await repository.findOne({
			where: { id: destinationId },
			select: { id: true, name: true },
			withDeleted: true
		});
		return destination?.name;
	}

	/**
	 * A clean import's wipe of `tenant_setting`: every row of the tenant, soft-deleted ones included, except the rows
	 * only the installation operator may write when someone else imports. Removing such a row would put the deployment
	 * default back, which may be no limit at all.
	 *
	 * @param repository - The `tenant_setting` repository.
	 * @param tenantId - The importing tenant.
	 */
	private async cleanUpTenantSettings(repository: Repository<any>, tenantId: ID | null): Promise<void> {
		if (!tenantId) {
			return;
		}
		await repository.delete(await keepingOperatorOnlySettings(repository, { tenantId }));
	}

	/**
	 * Whether the table holds rows every tenant shares: it has no tenant column. These are the tenants themselves, the
	 * countries, currencies and languages, the features and reports, the integration catalogue and the plugin
	 * marketplace — rows the platform seeds and every tenant reads.
	 *
	 * An archive used to be written into them like into any other table: a row that matched none was created for every
	 * tenant to see, and a row whose id an earlier import had mapped was saved over, so a tenant administrator could add
	 * to or rewrite the integration catalogue, the features or the marketplace of the whole installation by importing.
	 *
	 * @param item - The table being imported.
	 */
	private isSharedTable(item: IRepositoryModel): boolean {
		return !item.repository.metadata.findColumnWithPropertyName('tenantId');
	}

	/**
	 * The existing row a shared table's archive row stands for, or `null`: the row with the same unique key, else the
	 * row with the same id (an archive of this instance), else the row with the same natural key (another instance's,
	 * {@link SHARED_TABLE_NATURAL_KEYS}). Nothing is created or changed; a reference to a row that matches none maps to
	 * nothing, like any other unmapped relation.
	 *
	 * @param item - The shared table being imported.
	 * @param row - The row after {@link mapFields}.
	 * @param sourceId - The row's id in the archive.
	 */
	private async findSharedRow(item: IRepositoryModel, row: Record<string, unknown>, sourceId: unknown) {
		const { repository } = item;
		const naturalKeys = SHARED_TABLE_NATURAL_KEYS[repository.metadata.tableName] ?? [];
		const candidates: Record<string, unknown>[] = [
			...this.uniqueKeyConditions(item, row),
			...(typeof sourceId === 'string' && UUID.test(sourceId) ? [{ id: sourceId }] : []),
			...(naturalKeys.length > 0 && naturalKeys.every((key) => isNotEmpty(row[key]))
				? [Object.fromEntries(naturalKeys.map((key) => [key, row[key]]))]
				: [])
		];
		for (const where of candidates) {
			const existing = await repository.findOne({ where });
			if (existing) {
				return existing;
			}
		}
		return null;
	}

	/**
	 * One condition per unique constraint of the table, each matching every column of the constraint
	 * within the importing tenant. A constraint with an empty column is skipped: a null never collides,
	 * and an undefined key would be dropped from the query and match any row.
	 *
	 * @param item - The table being imported.
	 * @param row - The row after {@link mapFields}.
	 */
	private uniqueKeyConditions(item: IRepositoryModel, row: Record<string, unknown>): Record<string, unknown>[] {
		const { repository, uniqueConstraints = [] } = item;
		const isTenantScoped = !!repository.metadata.findColumnWithPropertyName('tenantId');
		const where: Record<string, unknown>[] = [];
		for (const columns of uniqueConstraints) {
			if (columns.some((column) => row[column] === null || row[column] === undefined)) {
				continue;
			}
			const condition: Record<string, unknown> = isTenantScoped ? { tenantId: row['tenantId'] ?? IsNull() } : {};
			for (const column of columns) {
				condition[column] = row[column];
			}
			where.push(condition);
		}
		return where;
	}

	/*
	 * Map import record after find or insert data
	 */
	async mappedImportRecord(item: IRepositoryModel, destination: any, row: any): Promise<any> {
		const { repository } = item;
		const entityType = repository.metadata.tableName;

		return await new Promise(async (resolve, reject) => {
			try {
				if (destination) {
					await this.commandBus.execute(
						new ImportRecordUpdateOrCreateCommand({
							tenantId: RequestContext.currentTenantId(),
							sourceId: row.id,
							destinationId: destination.id,
							entityType
						})
					);
				}
				resolve(true);
			} catch (error) {
				console.log(chalk.red(`Failed to map import record for table: ${entityType}`), error);
				reject(error);
			}
		});
	}

	/*
	 * Map tenant & organization base fields here
	 * Notice: Please add timestamp field here if missing
	 */
	async mapFields(item: IRepositoryModel, data: any) {
		if ('id' in data && isNotEmpty(data['id'])) {
			delete data['id'];
		}
		// An empty or missing tenantId would save the row without a tenant, where every tenant reads it
		// as a platform default, so any table with the column gets the importer's tenant.
		const hasTenantColumn = !!item.repository.metadata.findColumnWithPropertyName('tenantId');
		if (hasTenantColumn || ('tenantId' in data && isNotEmpty(data['tenantId']))) {
			data['tenantId'] = RequestContext.currentTenantId();
		}
		if ('organizationId' in data && isNotEmpty(data['organizationId'])) {
			try {
				const organization = await this.repositoriesService.typeOrmOrganizationRepository.findOneByOrFail({
					id: data['organizationId'],
					tenantId: RequestContext.currentTenantId()
				});
				data['organizationId'] = organization ? organization.id : IsNull().value;
			} catch (error) {
				const { record } = await this.commandBus.execute(
					new ImportRecordFindOrFailCommand({
						tenantId: RequestContext.currentTenantId(),
						sourceId: data['organizationId'],
						entityType: this.repositoriesService.typeOrmOrganizationRepository.metadata.tableName
					})
				);
				data['organizationId'] = record ? record.destinationId : IsNull().value;
			}
		}
		return await this.mapTimeStampsFields(item, await this.mapRelationFields(item, data));
	}

	/*
	 * Map timestamps fields here
	 */
	async mapTimeStampsFields(item: IRepositoryModel, data: any) {
		const { repository } = item;
		for await (const column of repository.metadata.columns as ColumnMetadata[]) {
			const { propertyName, type } = column;
			if (`${propertyName}` in data) {
				if (isNotEmpty(data[`${propertyName}`])) {
					if (type.valueOf() === Date || type === 'datetime' || type === 'timestamp') {
						data[`${propertyName}`] = convertToDatetime(data[`${propertyName}`]);
					} else if (data[`${propertyName}`] === 'true') {
						data[`${propertyName}`] = true;
					} else if (data[`${propertyName}`] === 'false') {
						data[`${propertyName}`] = false;
					}
				} else {
					data[`${propertyName}`] = null;
				}
			}
		}
		return data;
	}

	/**
	 * Helper function to map a list of foreign key relations.
	 * It uses the ImportRecordFindOrFailCommand to resolve destination IDs from source IDs (cdv files).
	 *
	 * @param data - The current row of CSV data being processed.
	 * @param relationSet - An array of relation definitions containing column name and  referenced repository.
	 */
	private async mapRelationSet(data: any, relationSet: IForeignKey[]): Promise<void> {
		for await (const { column, repository } of relationSet) {
			if (data[column]) {
				const { record } = await this.commandBus.execute(
					new ImportRecordFindOrFailCommand({
						tenantId: RequestContext.currentTenantId(),
						sourceId: data[column],
						entityType: repository.metadata.tableName
					})
				);
				data[column] = record ? record.destinationId : IsNull().value;
			}
		}
	}

	/*
	 * Map relation fields here
	 */
	async mapRelationFields(item: IRepositoryModel | IColumnRelationMetadata<any>, data: any): Promise<any> {
		return await new Promise(async (resolve, reject) => {
			try {
				const { foreignKeys = [], isCheckRelation = false } = item;

				// Map base entity relations fields
				await this.mapRelationSet(data, this.repositoriesService.baseEntityRelationFields);

				// Other entity relation fields
				if (isCheckRelation && isNotEmpty(foreignKeys)) {
					await this.mapRelationSet(data, foreignKeys);
				}

				resolve(data);
			} catch (error) {
				console.log(chalk.red('Failed to map relation entity before insert'), error);
				reject(error);
			}
		});
	}

	public async addCurrentUserToImportedOrganizations(extractPath: string) {
		const userId = RequestContext.currentUserId();

		const organizationsCsvPath = path.join(extractPath, 'organization.csv');
		const decodeCells = await usesSpreadsheetSafeCells(extractPath);

		return new Promise(async (resolve, reject) => {
			const results: Organization[] = [];
			const stream = fs.createReadStream(organizationsCsvPath, 'utf8').pipe(csv());
			stream.on('data', (data) => {
				// Undo the spreadsheet formula escape the export adds (GHSA-7xp5-j564-4752).
				if (isNotEmpty(data)) results.push(decodeCells ? fromSpreadsheetSafeCsvRow(data) : data);
			});
			stream.on('error', (error) => {
				console.log(chalk.red(`Failed to parse CSV for table: organization`), error);
				reject(error);
			});
			stream.on('end', async () => {
				try {
					for await (const organizationId of results.map((el) => el.id)) {
						const { record } = await this.commandBus.execute(
							new ImportRecordFindOrFailCommand({
								tenantId: RequestContext.currentTenantId(),
								sourceId: organizationId,
								entityType: this.repositoriesService.typeOrmOrganizationRepository.metadata.tableName
							})
						);

						if (!record || !record['destinationId']) continue;

						const isAlreadyIn = await this.repositoriesService.typeOrmUserOrganizationRepository.findOne({
							where: {
								userId,
								organizationId: record['destinationId']
							}
						});

						if (isAlreadyIn) continue;

						await this.repositoriesService.typeOrmUserOrganizationRepository.save({
							userId,
							organizationId: record['destinationId'],
							tenantId: RequestContext.currentTenantId()
						});
					}
				} catch (error) {
					console.log(chalk.red('Failed to add the current user to imported organization', error));
					reject(error);
				}
				resolve(true);
			});
		});
	}
}
