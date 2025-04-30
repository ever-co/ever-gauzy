import { Injectable, OnModuleInit } from '@nestjs/common';
import { FindManyOptions, IsNull } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as archiver from 'archiver';
import * as csv from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';
import { ConfigService } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from './../../core/context';

import { IColumnRelationMetadata, IRepositoryModel, RepositoriesService } from '../repositories/repositories.service';

@Injectable()
export class ExportService implements OnModuleInit {
	private _dirname: string;
	private _basename = '/export';

	public idZip = new BehaviorSubject<string>('');
	public idCsv = new BehaviorSubject<string>('');

	private repositories: IRepositoryModel[] = [];

	constructor(private repositoriesServices: RepositoriesService, private readonly configService: ConfigService) {}

	async onModuleInit() {
		const public_path = this.configService.assetOptions.assetPublicPath || __dirname;
		//base import csv directory path
		this._dirname = path.join(public_path, this._basename);
	}

	public async registerAllRepositories() {
		this.repositories = await this.repositoriesServices.buildRepositoriesRelationsGraph();
	}

	async createFolders(): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = uuidv4();
			this.idCsv.next(id);
			fs.access(`${this._dirname}/${id}/csv`, (error) => {
				if (!error) {
					return null;
				} else {
					fs.mkdir(`${this._dirname}/${id}/csv`, { recursive: true }, (err) => {
						if (err) reject(err);
						resolve('');
					});
				}
			});
		});
	}

	async archiveAndDownload(): Promise<any> {
		return new Promise((resolve, reject) => {
			{
				const id = uuidv4();
				const fileNameS = id + '_export.zip';
				this.idZip.next(fileNameS);

				const output = fs.createWriteStream(`${this._dirname}/${fileNameS}`);

				const archive = archiver('zip', {
					zlib: { level: 9 }
				});

				output.on('close', function () {
					resolve('');
				});

				output.on('end', function () {
					console.log('Data has been drained');
				});

				archive.on('warning', function (err) {
					if (err.code === 'ENOENT') {
						reject(err);
					} else {
						console.log('Unexpected error!');
					}
				});

				archive.on('error', function (err) {
					reject(err);
				});

				let id$ = '';
				this.idCsv.subscribe((idCsv) => {
					id$ = idCsv;
				});

				archive.pipe(output);
				archive.directory(`${this._dirname}/${id$}/csv`, false);
				archive.finalize();
			}
		});
	}

	async getAsCsv(item: IRepositoryModel, where: { tenantId: string }, organizationId?: string): Promise<any> {
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
			return await this.csvWriter(nameFile, [...items, ...defaultItems]);
		}

		return false;
	}

	async csvWriter(filename: string, items: any[]): Promise<boolean | any> {
		return new Promise((resolve, reject) => {
			try {
				const createCsvWriter = csv.createObjectCsvWriter;
				const dataIn = [];
				const dataKeys = Object.keys(items[0]);

				for (const count of dataKeys) {
					dataIn.push({ id: count, title: count });
				}

				let id$ = '';
				this.idCsv.subscribe((id) => {
					id$ = id;
				});

				const csvWriter = createCsvWriter({
					path: `${this._dirname}/${id$}/csv/${filename}.csv`,
					header: dataIn
				});

				csvWriter.writeRecords(items).then(() => {
					resolve(items);
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	async csvTemplateWriter(filename: string, columns: any): Promise<any> {
		if (columns) {
			return new Promise((resolve) => {
				const createCsvWriter = csv.createObjectCsvWriter;
				const dataIn = [];
				const dataKeys = columns;

				for (const count of dataKeys) {
					dataIn.push({ id: count, title: count });
				}

				let id$ = '';
				this.idCsv.subscribe((id) => {
					id$ = id;
				});

				const csvWriter = createCsvWriter({
					path: `${this._dirname}/${id$}/csv/${filename}.csv`,
					header: dataIn
				});

				csvWriter.writeRecords([]).then(() => {
					resolve('');
				});
			});
		}
		return false;
	}

	async downloadToUser(res): Promise<any> {
		return new Promise((resolve) => {
			let fileName = '';

			this.idZip.subscribe((filename) => {
				fileName = filename;
			});

			res.download(`${this._dirname}/${fileName}`);
			resolve('');
		});
	}

	async deleteCsvFiles(): Promise<any> {
		return new Promise((resolve) => {
			let id$ = '';

			this.idCsv.subscribe((id) => {
				id$ = id;
			});

			fs.access(`${this._dirname}/${id$}`, (error) => {
				if (!error) {
					fse.removeSync(`${this._dirname}/${id$}`);
					resolve('');
				} else {
					return null;
				}
			});
		});
	}
	async deleteArchive(): Promise<any> {
		return new Promise((resolve) => {
			let fileName = '';
			this.idZip.subscribe((fileName$) => {
				fileName = fileName$;
			});
			fs.access(`${this._dirname}/${fileName}`, (error) => {
				if (!error) {
					fse.removeSync(`${this._dirname}/${fileName}`);
					resolve('');
				} else {
					return null;
				}
			});
		});
	}

	async exportTables(organizationId: string) {
		return new Promise(async (resolve, reject) => {
			try {
				for await (const item of this.repositories) {
					await this.getAsCsv(
						item,
						{
							tenantId: RequestContext.currentTenantId()
						},
						organizationId
					);

					// export pivot relational tables
					if (isNotEmpty(item.relations)) {
						await this.exportRelationalTables(item, {
							tenantId: RequestContext.currentTenantId()
						});
					}
				}
				resolve(true);
			} catch (error) {
				reject(error);
			}
		});
	}

	async exportSpecificTables(names: string[], organizationId?: string) {
		return new Promise(async (resolve, reject) => {
			try {
				for await (const item of this.repositories) {
					const nameFile = item.repository.metadata.tableName;
					if (names.includes(nameFile)) {
						await this.getAsCsv(
							item,
							{
								tenantId: RequestContext.currentTenantId()
							},
							organizationId
						);

						// export pivot relational tables
						if (isNotEmpty(item.relations)) {
							await this.exportRelationalTables(item, {
								tenantId: RequestContext.currentTenantId()
							});
						}
					}
				}
				resolve(true);
			} catch (error) {
				reject(error);
			}
		});
	}

	/*
	 * Export Many To Many Pivot Table Using TypeORM Relations
	 */
	async exportRelationalTables(entity: IRepositoryModel, where: { tenantId: string }) {
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
						await this.csvWriter(referenceTableName, items);
					}
				}
			}
		}
	}

	async exportSpecificTablesSchema() {
		return new Promise(async (resolve, reject) => {
			try {
				for await (const item of this.repositories) {
					const { repository, relations } = item;
					const nameFile = repository.metadata.tableName;
					const columns = repository.metadata.ownColumns.map((column: ColumnMetadata) => column.propertyName);

					await this.csvTemplateWriter(nameFile, columns);

					// export pivot relational tables
					if (isNotEmpty(relations)) {
						await this.exportRelationalTablesSchema(item);
					}
				}
				resolve(true);
			} catch (error) {
				reject(error);
			}
		});
	}

	async exportRelationalTablesSchema(entity: IRepositoryModel) {
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

				await this.csvTemplateWriter(referenceTableName, columns);
			}
		}
	}
}
