import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FindManyOptions, In } from 'typeorm';
import { indexBy, keys, object, pluck } from 'underscore';
import { S3Client, CreateBucketCommand, CreateBucketCommandInput, CreateBucketCommandOutput } from '@aws-sdk/client-s3';
import { ITenantSetting, IWasabiFileStorageProviderConfig } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../../core/crud';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../../core/utils';
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

	/**
	 *
	 * @param request
	 * @returns
	 */
	async get(request?: FindManyOptions) {
		let settings: TenantSetting[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<TenantSetting>(request);
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				settings = items.map((entity: TenantSetting) => this.serialize(entity)) as TenantSetting[];
				break;
			case MultiORMEnum.TypeORM:
				settings = await this.typeOrmRepository.find(request);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		return object(pluck(settings, 'name'), pluck(settings, 'value'));
	}

	/**
	 *
	 * @param input
	 * @param tenantId
	 * @returns
	 */
	async saveSettings(input: ITenantSetting, tenantId: string): Promise<ITenantSetting> {
		const settingsName = keys(input);
		const settings: TenantSetting[] = await this.typeOrmRepository.find({
			where: {
				name: In(settingsName),
				tenantId
			}
		});

		const settingsByName = indexBy(settings, 'name');
		const saveInput = [];
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

		await this.typeOrmRepository.save(saveInput);
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

		// Create S3 wasabi endpoint
		const endpoint = entity.wasabi_aws_service_url;

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
			forcePathStyle: entity.wasabi_aws_force_path_style
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
