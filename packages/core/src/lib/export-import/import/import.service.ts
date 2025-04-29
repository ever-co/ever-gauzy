import { Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IsNull } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import * as fs from 'fs';
import * as unzipper from 'unzipper';
import * as csv from 'csv-parser';
import * as rimraf from 'rimraf';
import * as path from 'path';
import * as chalk from 'chalk';
import { ConfigService } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { convertToDatetime } from '../../core/utils';
import { FileStorage } from '../../core/file-storage';
import { Organization } from '../../core/entities/internal';
import { RequestContext } from '../../core';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { ImportRecordFindOrFailCommand, ImportRecordUpdateOrCreateCommand } from '../import-record';
import {
	IColumnRelationMetadata,
	IForeignKey,
	IRepositoryModel,
	RepositoriesService
} from '../repositories/repositories.service';

@Injectable()
export class ImportService implements OnModuleInit {
	private _dirname: string;
	private _extractPath: string;

	private repositories: IRepositoryModel[] = [];

	constructor(
		private readonly configService: ConfigService,
		private readonly commandBus: CommandBus,
		private repositoriesService: RepositoriesService
	) {}

	async onModuleInit() {
		//base import csv directory path
		this._dirname = path.join(this.configService.assetOptions.assetPublicPath || __dirname);
	}

	public async registerAllRepositories() {
		this.repositories = await this.repositoriesService.buildRepositoriesRelationsGraph();
	}

	public removeExtractedFiles() {
		try {
			rimraf.sync(this._extractPath);
		} catch (error) {
			console.log(error);
		}
	}

	public async unzipAndParse(filePath: string, cleanup: boolean = false) {
		//extracted import csv directory path
		this._extractPath = path.join(path.join(this._dirname, filePath), '../csv');

		const file = await new FileStorage().getProvider().getFile(filePath);
		await unzipper.Open.buffer(file).then((d) => d.extract({ path: this._extractPath }));
		await this.parse(cleanup);
	}

	async parse(cleanup: boolean = false) {
		/**
		 * Can only run in a particular order
		 */
		const tenantId = RequestContext.currentTenantId();
		for await (const item of this.repositories) {
			const { repository, isStatic = false, relations = [] } = item;
			const nameFile = repository.metadata.tableName;
			const csvPath = path.join(this._extractPath, `${nameFile}.csv`);
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
						results.push(data);
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

			// export pivot relational tables
			if (isNotEmpty(relations)) {
				await this.parseRelationalTables(item, cleanup);
			}
		}
	}

	async parseRelationalTables(entity: IRepositoryModel, cleanup: boolean = false) {
		const { relations } = entity;
		for await (const item of relations) {
			const { joinTableName } = item;
			const csvPath = path.join(this._extractPath, `${joinTableName}.csv`);

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
						results.push(data);
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

	public async addCurrentUserToImportedOrganizations() {
		const userId = RequestContext.currentUserId();

		const organizationsCsvPath = path.join(this._extractPath, 'organization.csv');

		return new Promise(async (resolve, reject) => {
			const results: Organization[] = [];
			const stream = fs.createReadStream(organizationsCsvPath, 'utf8').pipe(csv());
			stream.on('data', (data) => {
				if (isNotEmpty(data)) results.push(data);
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
