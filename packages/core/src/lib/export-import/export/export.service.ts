import { Injectable, Logger } from '@nestjs/common';
import { FindManyOptions, IsNull, Repository } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { v4 as uuidv4 } from 'uuid';
import * as archiver from 'archiver';
import * as csv from 'csv-writer';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { isFunction, isNotEmpty } from '@gauzy/utils';
import { RequestContext } from './../../core/context';
import { ExportEntityClass, redactForExport } from '../export-redact.decorator';

import { IColumnRelationMetadata, IRepositoryModel, RepositoriesService } from '../repositories/repositories.service';

/**
 * Everything one `/export` request needs to know about its own files.
 *
 * 🛑 This used to live on the service as `idCsv`/`idZip` RxJS subjects plus a `_dirname` field, and
 * `ExportService` is an ordinary singleton provider. A full export loops every repository in the
 * graph with a database round-trip each, so it spans seconds of real async I/O — long enough for a
 * second tenant's request to call `createFolders()` in the middle of the first one and move the
 * shared ids out from under it. Tenant A then archived tenant B's directory, or deleted it
 * (GHSA-g235-c4fm-4fc7). Passing the job explicitly is what makes the singleton safe; it is not a
 * style preference.
 */
export interface IExportJob {
	/** Unique id of this job. Also the stem of the archive's file name. */
	readonly id: string;
	/** Private scratch root for this job, removed by {@link ExportService.cleanup}. */
	readonly workDir: string;
	/** Directory the per-table CSVs are written into; becomes the archive's root. */
	readonly csvDir: string;
	/** Absolute path of the ZIP that is streamed to the caller. */
	readonly archivePath: string;
	/** File name the caller sees in `Content-Disposition` — unchanged: `<uuid>_export.zip`. */
	readonly archiveName: string;
}

@Injectable()
export class ExportService {
	private readonly logger = new Logger(ExportService.name);

	/**
	 * The export/import repository graph, built once.
	 *
	 * It is derived entirely from `RepositoriesService`'s module-init state (core repositories plus
	 * the plugin entities discovered at boot) and never from the request, so one shared copy is
	 * correct — unlike the file paths above. Caching it also fixes `/export/template`, which never
	 * called `registerAllRepositories()` and therefore produced an EMPTY template archive unless
	 * some earlier `/export` request happened to have populated the field first.
	 */
	private repositories: Promise<IRepositoryModel[]> | null = null;

	constructor(private repositoriesServices: RepositoriesService) {}

	/**
	 * Builds (once) and returns the repository graph to export.
	 */
	private async getRepositories(): Promise<IRepositoryModel[]> {
		if (!this.repositories) {
			// Do not cache a rejection: a transient failure must not poison every later request.
			this.repositories = this.repositoriesServices.buildRepositoriesRelationsGraph().catch((error) => {
				this.repositories = null;
				throw error;
			});
		}
		return this.repositories;
	}

	/**
	 * Creates a private scratch directory for one export request.
	 *
	 * 🛑 The scratch root is `os.tmpdir()`, deliberately NOT `assetOptions.assetPublicPath`. That
	 * directory is mounted by `ServeStaticModule` at `/public/` with no authentication, so every
	 * intermediate CSV and the finished ZIP used to be downloadable over HTTP for as long as they
	 * existed — and forever when a request failed before the delete step.
	 *
	 * @returns The job handle to thread through the rest of the export.
	 */
	async createExportJob(): Promise<IExportJob> {
		const id = uuidv4();
		const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gauzy-export-'));
		const csvDir = path.join(workDir, 'csv');
		await fsp.mkdir(csvDir, { recursive: true });

		const archiveName = `${id}_export.zip`;

		return { id, workDir, csvDir, archivePath: path.join(workDir, archiveName), archiveName };
	}

	/**
	 * Removes everything this job wrote. Safe to call twice, and safe to call on a job whose export
	 * threw half-way — which is exactly why the controller calls it from a `finally`.
	 *
	 * @param job - The job to clean up.
	 */
	async cleanup(job: IExportJob): Promise<void> {
		if (!job?.workDir) {
			return;
		}
		try {
			await fsp.rm(job.workDir, { recursive: true, force: true });
		} catch (error) {
			// Never fail a finished request because its scratch directory would not go away.
			this.logger.error(`Failed to remove export scratch directory ${job.workDir}`, error?.stack);
		}
	}

	/**
	 * Zips this job's CSV directory into this job's archive.
	 *
	 * @param job - The job being exported.
	 */
	async archiveAndDownload(job: IExportJob): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const output = fs.createWriteStream(job.archivePath);
			const archive = archiver('zip', { zlib: { level: 9 } });

			output.on('close', () => resolve());
			output.on('error', (error) => reject(error));

			archive.on('warning', (error: any) => {
				if (error.code === 'ENOENT') {
					reject(error);
				} else {
					this.logger.warn(`Unexpected archiver warning while exporting: ${error?.message}`);
				}
			});
			archive.on('error', (error) => reject(error));

			archive.pipe(output);
			archive.directory(job.csvDir, false);

			// `finalize()` returns a promise; an unhandled rejection here used to leave the request
			// hanging until the client timed out.
			Promise.resolve(archive.finalize()).catch(reject);
		});
	}

	/**
	 * Reads one table and writes it as a CSV inside the job's directory.
	 *
	 * @param job - The job being exported.
	 * @param item - The repository graph entry to export.
	 * @param where - Tenant scope of the export.
	 * @param organizationId - Organization the global default rows are stamped with.
	 */
	async getAsCsv(
		job: IExportJob,
		item: IRepositoryModel,
		where: { tenantId: string },
		organizationId?: string
	): Promise<boolean> {
		const conditions: FindManyOptions = {};
		if (item.isTenantBased !== false) {
			conditions['where'] = {
				tenantId: where['tenantId']
			};
		}

		/*
		 * Replace condition with default condition
		 */
		if (isNotEmpty(item.substitute) && isNotEmpty(conditions['where'])) {
			const {
				substitute: { originalField = 'tenantId', substituteField = 'id' }
			} = item;
			if (`${originalField}` in conditions['where']) {
				delete conditions['where'][originalField];
				conditions['where'][substituteField] = where[originalField];
			}
		}

		const { repository } = item;
		const nameFile = repository.metadata.tableName;

		const [items, itemsCount] = await repository.findAndCount(conditions);

		/**
		 * Include global (default) entities used in the current organization.
		 * E.g., task statuses, task priorities, etc.
		 */

		const columnNames = repository.metadata.columns.map((col) => col.databaseName);
		const hasTenantId = columnNames.includes('tenantId');
		const hasOrganizationId = columnNames.includes('organizationId');

		let defaultItems: unknown[] = [];
		let defaultItemsCount = 0;

		if (item.isTenantBased !== false && hasTenantId && hasOrganizationId) {
			[defaultItems, defaultItemsCount] = await repository.findAndCount({
				where: {
					tenantId: IsNull(),
					organizationId: IsNull()
				}
			});
		}

		const count = itemsCount + defaultItemsCount;

		if (defaultItemsCount > 0) {
			defaultItems.forEach((el) => {
				el['organizationId'] = organizationId ?? null;
				el['tenantId'] = RequestContext.currentTenantId();
			});
		}

		if (count > 0) {
			const rows = this.redactRows(repository, [...items, ...defaultItems]);
			await this.csvWriter(job, nameFile, rows);
			return true;
		}

		return false;
	}

	/**
	 * Turns hydrated entities into the plain rows that go into the archive.
	 *
	 * 🛑 This is the single choke point for secret masking on the export path, and it has to be here
	 * rather than in the writer: `csv-writer` reads `object[property]` directly and never runs
	 * `class-transformer`, so `@Exclude({ toPlainOnly: true })` and the `@Expose`d `wrapSecret*`
	 * mirrors — the whole of the JSON path's masking — simply do not apply to a CSV
	 * (GHSA-j5h5-r956-rxc3). Columns opt in declaratively with `@ExportRedacted()`.
	 *
	 * Rows are also projected onto the entity's persisted columns, which drops the properties
	 * subscribers attach on load (`IntegrationSettingSubscriber.wrapSecretValue`) and the computed
	 * `@VirtualMultiOrmColumn` ones. Neither round-trips, and both are a route for a future
	 * subscriber to put a cleartext credential back into the archive behind the column marks' back.
	 *
	 * @param repository - The repository the rows were loaded from.
	 * @param rows - Hydrated entities.
	 * @returns Plain objects safe to hand to `csv-writer`.
	 */
	private redactRows(repository: Repository<any>, rows: unknown[]): Record<string, unknown>[] {
		const entity = repository.metadata.target;
		const columns = repository.metadata.columns.map((column: ColumnMetadata) => column.propertyName);

		// Fail closed, loudly: a table whose entity class cannot be resolved is a table whose secret
		// columns cannot be known, and writing it "just in case" is how the cleartext got out.
		if (!isFunction(entity)) {
			throw new TypeError(
				`Refusing to export "${repository.metadata.tableName}": its entity class could not be resolved, so redaction marks cannot be read`
			);
		}

		return rows.map((row) => redactForExport(entity as ExportEntityClass, row as object, columns));
	}

	/**
	 * Writes one CSV file into the job's directory.
	 *
	 * @param job - The job being exported.
	 * @param filename - Table name (the CSV's stem).
	 * @param items - Plain rows to write.
	 */
	async csvWriter(job: IExportJob, filename: string, items: Record<string, unknown>[]): Promise<void> {
		if (!isNotEmpty(items)) {
			return;
		}

		const header = Object.keys(items[0]).map((key) => ({ id: key, title: key }));

		const csvWriter = csv.createObjectCsvWriter({
			path: path.join(job.csvDir, `${filename}.csv`),
			header
		});

		// Awaited, not `.then()`-ed: the old code dropped the rejection, so a write failure (another
		// request's cleanup removing the directory, a full disk) left the promise pending forever.
		await csvWriter.writeRecords(items);
	}

	/**
	 * Writes an empty CSV carrying only the table's column headers.
	 *
	 * @param job - The job being exported.
	 * @param filename - Table name (the CSV's stem).
	 * @param columns - Column names to use as the header.
	 */
	async csvTemplateWriter(job: IExportJob, filename: string, columns: string[]): Promise<void> {
		if (!isNotEmpty(columns)) {
			return;
		}

		const header = columns.map((key) => ({ id: key, title: key }));

		const csvWriter = csv.createObjectCsvWriter({
			path: path.join(job.csvDir, `${filename}.csv`),
			header
		});

		await csvWriter.writeRecords([]);
	}

	/**
	 * Streams this job's archive to the caller.
	 *
	 * Resolves only once the response has actually been written, so the controller's `finally` can
	 * delete the file without racing the stream (which truncates downloads on Windows/Electron).
	 *
	 * @param job - The job whose archive to send.
	 * @param res - The Express response.
	 */
	async downloadToUser(job: IExportJob, res): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			res.download(job.archivePath, job.archiveName, (error: Error) => {
				if (!error) {
					return resolve();
				}
				// Once bytes are on the wire there is nothing to report to the client; surface the
				// failure only while a proper error response is still possible.
				if (res.headersSent) {
					this.logger.error(`Export download failed after headers were sent: ${error.message}`);
					return resolve();
				}
				reject(error);
			});
		});
	}

	/**
	 * Exports every table in the graph.
	 *
	 * @param job - The job being exported.
	 * @param organizationId - Organization the global default rows are stamped with.
	 */
	async exportTables(job: IExportJob, organizationId: string): Promise<boolean> {
		const repositories = await this.getRepositories();

		for await (const item of repositories) {
			await this.getAsCsv(
				job,
				item,
				{
					tenantId: RequestContext.currentTenantId()
				},
				organizationId
			);

			// export pivot relational tables
			if (isNotEmpty(item.relations)) {
				await this.exportRelationalTables(job, item, {
					tenantId: RequestContext.currentTenantId()
				});
			}
		}

		return true;
	}

	/**
	 * Exports only the named tables.
	 *
	 * @param job - The job being exported.
	 * @param names - Table names requested by the caller.
	 * @param organizationId - Organization the global default rows are stamped with.
	 */
	async exportSpecificTables(job: IExportJob, names: string[], organizationId?: string): Promise<boolean> {
		const repositories = await this.getRepositories();

		for await (const item of repositories) {
			const nameFile = item.repository.metadata.tableName;
			if (names.includes(nameFile)) {
				await this.getAsCsv(
					job,
					item,
					{
						tenantId: RequestContext.currentTenantId()
					},
					organizationId
				);

				// export pivot relational tables
				if (isNotEmpty(item.relations)) {
					await this.exportRelationalTables(job, item, {
						tenantId: RequestContext.currentTenantId()
					});
				}
			}
		}

		return true;
	}

	/*
	 * Export Many To Many Pivot Table Using TypeORM Relations
	 */
	async exportRelationalTables(job: IExportJob, entity: IRepositoryModel, where: { tenantId: string }) {
		const { repository, relations } = entity;
		const masterTable = repository.metadata.givenTableName as string;

		for await (const item of repository.metadata.manyToManyRelations) {
			const relation = relations.find(
				(relation: IColumnRelationMetadata<any>) => relation.joinTableName === item.joinTableName
			);
			if (relation) {
				const [joinColumn] = item.joinColumns as ColumnMetadata[];
				if (joinColumn) {
					const { entityMetadata, propertyName, referencedColumn } = joinColumn;

					const referenceColumn = referencedColumn.propertyName;
					const referenceTableName = entityMetadata.givenTableName;
					let sql = `
						SELECT
							${referenceTableName}.*
						FROM
							${referenceTableName}
						INNER JOIN "${masterTable}"
							ON "${referenceTableName}"."${propertyName}" = "${masterTable}"."${referenceColumn}"
					`;
					if (entity.isTenantBased !== false) {
						sql += ` WHERE "${masterTable}"."tenantId" = '${where['tenantId']}'`;
					}

					const items = await repository.manager.query(sql);
					if (isNotEmpty(items)) {
						// Junction rows are raw SQL results holding only the two foreign keys, so
						// there is no entity class to resolve redaction marks against and nothing
						// secret to redact.
						await this.csvWriter(job, referenceTableName, items);
					}
				}
			}
		}
	}

	/**
	 * Writes a header-only CSV for every table in the graph (the import template).
	 *
	 * @param job - The job being exported.
	 */
	async exportSpecificTablesSchema(job: IExportJob): Promise<boolean> {
		const repositories = await this.getRepositories();

		for await (const item of repositories) {
			const { repository, relations } = item;
			const nameFile = repository.metadata.tableName;
			const columns = repository.metadata.ownColumns.map((column: ColumnMetadata) => column.propertyName);

			await this.csvTemplateWriter(job, nameFile, columns);

			// export pivot relational tables
			if (isNotEmpty(relations)) {
				await this.exportRelationalTablesSchema(job, item);
			}
		}

		return true;
	}

	/**
	 * Writes header-only CSVs for the many-to-many junction tables.
	 *
	 * @param job - The job being exported.
	 * @param entity - The repository graph entry whose relations to describe.
	 */
	async exportRelationalTablesSchema(job: IExportJob, entity: IRepositoryModel) {
		const { repository, relations } = entity;
		for await (const item of repository.metadata.manyToManyRelations) {
			const relation = relations.find(
				(relation: IColumnRelationMetadata) => relation.joinTableName === item.joinTableName
			);
			if (relation) {
				const referenceTableName = item.junctionEntityMetadata.givenTableName;
				const columns = item.junctionEntityMetadata.columns.map(
					(column: ColumnMetadata) => column.propertyName
				);

				await this.csvTemplateWriter(job, referenceTableName, columns);
			}
		}
	}
}
