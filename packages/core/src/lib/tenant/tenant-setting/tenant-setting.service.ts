import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { DeleteResult, FindManyOptions, FindOptionsWhere, In, IsNull, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { FindOptions } from '@mikro-orm/core';
import { indexBy, keys, object, pluck } from 'underscore';
import { S3Client, CreateBucketCommand, CreateBucketCommandInput, CreateBucketCommandOutput } from '@aws-sdk/client-s3';
import { ID, ITenantSetting, IWasabiFileStorageProviderConfig } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../../core/crud';
import { IFindOneOptions, IPartialEntity } from '../../core/crud/icrud.service';
import { refusalForStorageEndpoint, tenantStorageHttpsAgent } from '../../core/file-storage/storage-endpoint-policy';
import { LegacyFindOneOptions, MultiORMEnum, parseTypeORMFindToMikroOrm } from '../../core/utils';
import { RequestContext } from '../../core/context';
import { Tenant } from '../../core/entities/internal';
import { mayWriteGlobalSettings, OPERATOR_USER_IDS_ENV } from './global-setting-writer';
import { assertMayWriteTenantSettings } from './operator-only-tenant-settings';
import { TenantSetting } from './tenant-setting.entity';
import { TypeOrmTenantSettingRepository } from './repository/type-orm-tenant-setting.repository';
import { MikroOrmTenantSettingRepository } from './repository/mikro-orm-tenant-setting.repository';

@Injectable()
export class TenantSettingService extends TenantAwareCrudService<TenantSetting> {
	constructor(
		typeOrmTenantSettingRepository: TypeOrmTenantSettingRepository,
		mikroOrmTenantSettingRepository: MikroOrmTenantSettingRepository
	) {
		super(typeOrmTenantSettingRepository, mikroOrmTenantSettingRepository);
	}

	/*
	 * The row writes the CRUD controller gives `/tenant-setting` (`POST /`, `PUT :id`, `DELETE :id`, `DELETE :id/soft`,
	 * `PUT :id/recover`) and their GraphQL fields name a row by its id, so they could create, rename, change, remove or
	 * bring back an operator-only setting (`operator-only-tenant-settings.ts`) that the settings document routes refuse.
	 * Each checks the names of the rows it touches, and the name it gives one, before it writes.
	 */

	/**
	 * Creates a setting row, unless it is an operator-only setting and the caller does not operate the installation.
	 */
	public async create(entity: IPartialEntity<TenantSetting>): Promise<TenantSetting> {
		assertMayWriteTenantSettings([entity?.name]);
		return await super.create(entity);
	}

	/**
	 * Updates setting rows, unless one of them is, or the update renames one to, an operator-only setting and the
	 * caller does not operate the installation.
	 */
	public async update(
		id: string | FindOptionsWhere<TenantSetting>,
		partialEntity: QueryDeepPartialEntity<TenantSetting>
	): Promise<TenantSetting | UpdateResult> {
		assertMayWriteTenantSettings([
			(partialEntity as Partial<TenantSetting> | undefined)?.name,
			...(await this.namesOfRows(id))
		]);
		return await super.update(id, partialEntity);
	}

	/**
	 * Deletes setting rows, unless one of them is an operator-only setting and the caller does not operate the
	 * installation: without the row, the deployment default applies again.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<TenantSetting>,
		options?: LegacyFindOneOptions<TenantSetting>
	): Promise<DeleteResult> {
		const where = typeof criteria === 'string' ? { id: criteria } : { ...criteria, ...(options?.where ?? {}) };
		assertMayWriteTenantSettings(await this.namesOfRows(where as FindOptionsWhere<TenantSetting>));
		return await super.delete(criteria, options);
	}

	/**
	 * Soft-deletes a setting row, unless it is an operator-only setting and the caller does not operate the
	 * installation. Checked before the base method, which answers any failure as a 404.
	 */
	public async softRemove(
		id: ID,
		options?: IFindOneOptions<TenantSetting>,
		saveOptions?: SaveOptions
	): Promise<TenantSetting> {
		assertMayWriteTenantSettings(await this.namesOfRows(id));
		return await super.softRemove(id, options, saveOptions);
	}

	/**
	 * Brings a soft-deleted setting row back, unless it is an operator-only setting and the caller does not operate the
	 * installation.
	 */
	public async softRecover(
		id: ID,
		options?: IFindOneOptions<TenantSetting>,
		saveOptions?: SaveOptions
	): Promise<TenantSetting> {
		assertMayWriteTenantSettings(await this.namesOfRows(id));
		return await super.softRecover(id, options, saveOptions);
	}

	/**
	 * The names of the caller's setting rows that a write names, soft-deleted ones included.
	 *
	 * A criteria with no member selects nothing here, and the write itself answers it as it always has. A lookup that
	 * fails (an id that is not a UUID) is answered as the row writes answer a missing row, never let through unchecked.
	 *
	 * @param criteria A row id, or the conditions of the write.
	 * @returns The names of the rows, in the caller's tenant.
	 * @throws NotFoundException when the rows cannot be read.
	 */
	private async namesOfRows(criteria: string | FindOptionsWhere<TenantSetting>): Promise<string[]> {
		const where = (typeof criteria === 'string' ? { id: criteria } : criteria) as FindOptionsWhere<TenantSetting>;
		if (!where || typeof where !== 'object' || Object.keys(where).length === 0) {
			return [];
		}
		try {
			const rows = await this.find({ where, withDeleted: true });
			return (rows ?? []).map((row) => row.name);
		} catch {
			throw new NotFoundException('The record was not found');
		}
	}

	/**
	 * Retrieves settings with hierarchical cascade resolution.
	 * Priority (highest to lowest): Tenant DB → Global DB (tenantId=NULL) → Environment variables
	 *
	 * @param {string[]} names - Array of setting names to retrieve.
	 * @param {ID} [tenantId] - Optional tenant ID. If not provided, only global and env settings are returned.
	 * @param {Record<string, string>} [envDefaults] - Optional environment variable defaults (key = setting name, value = env value).
	 * @returns {Promise<Record<string, string>>} - A key-value pair object with resolved settings.
	 */
	async getResolvedSettings(
		names: string[],
		tenantId?: ID,
		envDefaults?: Record<string, string>
	): Promise<Record<string, string>> {
		// Start with environment defaults
		const resolvedSettings: Record<string, string> = { ...(envDefaults || {}) };

		// Fetch global settings (tenantId = NULL)
		let globalSettings: TenantSetting[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where: globalWhere, mikroOptions: globalMikroOptions } =
					parseTypeORMFindToMikroOrm<TenantSetting>({
						where: { name: In(names), tenantId: IsNull() }
					});
				const globalItems = await this.mikroOrmRepository.find(globalWhere, globalMikroOptions);
				globalSettings = globalItems.map((entity: TenantSetting) => this.serialize(entity)) as TenantSetting[];
				break;
			}
			case MultiORMEnum.TypeORM: {
				globalSettings = await this.typeOrmRepository.find({
					where: { name: In(names), tenantId: IsNull() }
				});
				break;
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		// Override with global DB settings
		for (const setting of globalSettings) {
			if (setting.value !== undefined && setting.value !== null) {
				resolvedSettings[setting.name] = setting.value;
			}
		}

		// If tenantId is provided, fetch tenant-specific settings
		if (tenantId) {
			let tenantSettings: TenantSetting[];
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { where: tenantWhere, mikroOptions: tenantMikroOptions } =
						parseTypeORMFindToMikroOrm<TenantSetting>({
							where: { name: In(names), tenantId: tenantId as string }
						});
					const tenantItems = await this.mikroOrmRepository.find(tenantWhere, tenantMikroOptions);
					tenantSettings = tenantItems.map((entity: TenantSetting) =>
						this.serialize(entity)
					) as TenantSetting[];
					break;
				}
				case MultiORMEnum.TypeORM: {
					tenantSettings = await this.typeOrmRepository.find({
						where: { name: In(names), tenantId: tenantId as string }
					});
					break;
				}
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			// Override with tenant-specific settings
			for (const setting of tenantSettings) {
				if (setting.value !== undefined && setting.value !== null) {
					resolvedSettings[setting.name] = setting.value;
				}
			}
		}

		return resolvedSettings;
	}

	/**
	 * Saves or updates global settings in the database (tenantId = NULL).
	 *
	 * @param {ITenantSetting} input - An object containing settings where keys are setting names and values are setting values.
	 * @returns {Promise<ITenantSetting>} - Returns the updated settings as a key-value object.
	 */
	async saveGlobalSettings(input: ITenantSetting): Promise<ITenantSetting> {
		let settings: TenantSetting[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<TenantSetting>({
					where: { name: In(keys(input)), tenantId: IsNull() }
				});
				// The managed entities, written back below: a serialized copy is a plain object, which
				// persistAndFlush rejects (not a discovered entity), so saving an existing setting failed.
				// Read with the default load hints: with the helper's `any` hints, `find` would return
				// `Loaded<TenantSetting, any, any, any>[]`, which is not assignable to `TenantSetting[]`.
				settings = await this.mikroOrmRepository.find(where, mikroOptions as FindOptions<TenantSetting>);
				break;
			}
			case MultiORMEnum.TypeORM: {
				settings = await this.typeOrmRepository.find({
					where: { name: In(keys(input)), tenantId: IsNull() }
				});
				break;
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		const settingsByName = indexBy(settings, 'name');
		const saveInput: TenantSetting[] = [];

		for (const key in input) {
			if (Object.prototype.hasOwnProperty.call(input, key)) {
				const setting = settingsByName[key];
				if (setting !== undefined) {
					setting.value = input[key];
					saveInput.push(setting);
				} else {
					saveInput.push(
						new TenantSetting({
							value: input[key],
							name: key,
							tenantId: null
						})
					);
				}
			}
		}

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				await this.mikroOrmRepository.getEntityManager().persistAndFlush(saveInput);
				break;
			}
			case MultiORMEnum.TypeORM: {
				await this.typeOrmRepository.save(saveInput);
				break;
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
		return object(pluck(saveInput, 'name'), pluck(saveInput, 'value'));
	}

	/**
	 * Refuses a write of the installation-wide settings by anyone but the operator of the installation
	 * (see `global-setting-writer.ts`): `GLOBAL_SETTING` alone is held by every tenant's super admin.
	 *
	 * @throws ForbiddenException when the signed-in user does not operate the installation.
	 */
	async assertMayWriteGlobalSettings(): Promise<void> {
		if (!(await mayWriteGlobalSettings(RequestContext.currentUserId(), () => this.countTenants()))) {
			throw new ForbiddenException(
				`Only the operator of this installation may change its global settings (${OPERATOR_USER_IDS_ENV}).`
			);
		}
	}

	/**
	 * How many tenants the installation has, soft-deleted ones aside.
	 *
	 * @returns The number of tenants.
	 */
	async countTenants(): Promise<number> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmRepository.getEntityManager().count(Tenant, {});
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.manager.count(Tenant);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Retrieves global settings from the database (tenantId = NULL).
	 *
	 * @param {string[]} [names] - Optional array of setting names to retrieve. If not provided, all global settings are returned.
	 * @returns {Promise<Record<string, any>>} - A key-value pair object with global settings.
	 */
	async getGlobalSettings(names?: string[]): Promise<Record<string, any>> {
		const whereClause: any = { tenantId: IsNull() };
		if (names && names.length > 0) {
			whereClause.name = In(names);
		}

		let settings: TenantSetting[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<TenantSetting>({
					where: whereClause
				});
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				settings = items.map((entity: TenantSetting) => this.serialize(entity)) as TenantSetting[];
				break;
			}
			case MultiORMEnum.TypeORM: {
				settings = await this.typeOrmRepository.find({ where: whereClause });
				break;
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
		return object(pluck(settings, 'name'), pluck(settings, 'value'));
	}

	/**
	 * Retrieves tenant settings from the database based on the ORM type being used.
	 *
	 * @param {FindManyOptions} [request] - Optional query options for filtering settings.
	 * @returns {Promise<Record<string, any>>} - A key-value pair object where keys are setting names and values are setting values.
	 *
	 * @throws {Error} - Throws an error if the ORM type is not implemented.
	 */
	async getSettings(request?: FindManyOptions<TenantSetting>): Promise<Record<string, any>> {
		let settings: TenantSetting[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<TenantSetting>(request);
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				settings = items.map((entity: TenantSetting) => this.serialize(entity)) as TenantSetting[];
				break;
			}
			case MultiORMEnum.TypeORM: {
				settings = await this.typeOrmRepository.find(request);
				break;
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		return object(pluck(settings, 'name'), pluck(settings, 'value'));
	}

	/**
	 * Saves or updates tenant settings in the database.
	 *
	 * @param {ITenantSetting} input - An object containing tenant settings where keys are setting names and values are setting values.
	 * @param {ID} tenantId - The unique identifier of the tenant.
	 * @returns {Promise<ITenantSetting>} - Returns the updated settings as a key-value object.
	 *
	 * @throws {Error} - Throws an error if the operation fails.
	 */
	async saveSettings(input: ITenantSetting, tenantId: ID): Promise<ITenantSetting> {
		let settings: TenantSetting[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<TenantSetting>({
					where: { name: In(keys(input)), tenantId }
				});
				// The managed entities, written back below: a serialized copy is a plain object, which
				// persistAndFlush rejects (not a discovered entity), so saving an existing setting failed.
				// Read with the default load hints: with the helper's `any` hints, `find` would return
				// `Loaded<TenantSetting, any, any, any>[]`, which is not assignable to `TenantSetting[]`.
				settings = await this.mikroOrmRepository.find(where, mikroOptions as FindOptions<TenantSetting>);
				break;
			}
			case MultiORMEnum.TypeORM: {
				settings = await this.typeOrmRepository.findBy({ name: In(keys(input)), tenantId });
				break;
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		const settingsByName = indexBy(settings, 'name');
		const saveInput: TenantSetting[] = [];

		for (const key in input) {
			if (Object.prototype.hasOwnProperty.call(input, key)) {
				const setting = settingsByName[key];
				if (setting !== undefined) {
					setting.value = input[key];
					saveInput.push(setting);
				} else {
					saveInput.push(
						new TenantSetting({
							value: input[key],
							name: key,
							tenantId
						})
					);
				}
			}
		}

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				await this.mikroOrmRepository.getEntityManager().persistAndFlush(saveInput);
				break;
			}
			case MultiORMEnum.TypeORM: {
				await this.typeOrmRepository.save(saveInput);
				break;
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
		return object(pluck(saveInput, 'name'), pluck(saveInput, 'value'));
	}

	/**
	 * Verify Wasabi Configuration
	 * @param entity - Configuration details for Wasabi
	 * @returns Promise containing the verification status
	 */
	public async verifyWasabiConfiguration(
		entity: IWasabiFileStorageProviderConfig
	): Promise<Object | BadRequestException> {
		// Validate the input data (You can use class-validator for validation)
		if (!entity.wasabi_aws_access_key_id || !entity.wasabi_aws_secret_access_key) {
			throw new HttpException(
				'Please include the required parameters as some are missing in your request.',
				HttpStatus.BAD_REQUEST
			);
		}

		// Create S3 wasabi endpoint: the API connects to it, so it must point at a public host.
		const endpoint = entity.wasabi_aws_service_url;
		const refusal = endpoint ? refusalForStorageEndpoint(endpoint) : undefined;
		if (refusal) {
			throw new BadRequestException(refusal);
		}

		// Create S3 wasabi region
		const region = entity.wasabi_aws_default_region;

		// Create S3 client service object
		const s3Client = new S3Client({
			credentials: {
				accessKeyId: entity.wasabi_aws_access_key_id,
				secretAccessKey: entity.wasabi_aws_secret_access_key
			},
			region,
			endpoint,
			/**
			 * Whether to force path style URLs for S3 objects
			 * (e.g., https://s3.amazonaws.com/<bucketName>/<key> instead of https://<bucketName>.s3.amazonaws.com/<key>
			 */
			forcePathStyle: entity.wasabi_aws_force_path_style,
			// A public name that resolves to a private address is refused when the connection is made.
			...(endpoint ? { requestHandler: { httpsAgent: tenantStorageHttpsAgent() } } : {})
		});

		// Create the parameters for calling createBucket
		const params: CreateBucketCommandInput = {
			Bucket: entity.wasabi_aws_bucket
		};

		try {
			// call S3 to create the bucket
			const data: CreateBucketCommandOutput = await s3Client.send(new CreateBucketCommand(params));
			return new Object({
				status: HttpStatus.CREATED,
				message: `${entity.wasabi_aws_bucket} is created successfully in ${entity.wasabi_aws_default_region}`,
				data
			});
		} catch (error) {
			console.log('Error while creating wasabi bucket: %s', params.Bucket);
			throw new HttpException(error, HttpStatus.BAD_REQUEST, {
				description: `Error while creating wasabi bucket: ${params.Bucket}`
			});
		}
	}
}
