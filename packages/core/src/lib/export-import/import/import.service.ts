import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IsNull } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as unzipper from 'unzipper';
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
import { fromSpreadsheetSafeCsvRow } from '../spreadsheet-safe-row';
import { usesSpreadsheetSafeCells } from '../export-manifest';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
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
		await unzipper.Open.buffer(file).then((d) => d.extract({ path: extractPath }));
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
					if (cleanup && isStatic !== true) {
						try {
							let sql = `DELETE FROM "${masterTable}" WHERE "${masterTable}"."tenantId" = '${tenantId}'`;
							await repository.query(sql);
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
								if (isNotEmpty(data)) {
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

			// export pivot relational tables
			if (isNotEmpty(relations)) {
				await this.parseRelationalTables(extractPath, item, cleanup, decodeCells);
			}
		}
	}

	/**
	 * Imports the junction tables of one entity.
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

						for await (const data of results) {
							try {
								if (isNotEmpty(data)) {
									const fields = await this.mapRelationFields(item, data);
									const sql = `INSERT INTO "${joinTableName}" (${
										'"' + Object.keys(fields).join(`", "`) + '"'
									}) VALUES ("$1", "$2")`;
									// const items = await getManager().query(sql, Object.values(fields));
									console.log(sql);
									// console.log(chalk.green(`Success to inserts data for table: ${joinTableName}`));
								}
							} catch (error) {
								console.log(chalk.red(`Failed to inserts data for table: ${joinTableName}`), error);
								reject(error);
							}
						}
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
		const { repository, uniqueIdentifiers = [] } = item;
		const masterTable = repository.metadata.tableName;

		return await new Promise(async (resolve, reject) => {
			try {
				const source = JSON.parse(JSON.stringify(entity));
				const where = [];
				if (isNotEmpty(uniqueIdentifiers) && Array.isArray(uniqueIdentifiers)) {
					if ('tenantId' in entity && isNotEmpty(entity['tenantId'])) {
						where.push({ tenantId: RequestContext.currentTenantId() });
					}
					for (const unique of uniqueIdentifiers) {
						where.push({ [unique.column]: entity[unique.column] });
					}
				}
				const destination = await this.commandBus.execute(
					new ImportEntityFieldMapOrCreateCommand(
						repository,
						where,
						await this.mapFields(item, entity),
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
		if ('tenantId' in data && isNotEmpty(data['tenantId'])) {
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
