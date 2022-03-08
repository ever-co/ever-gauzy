import { ITenantSetting, IWasabiFileStorageProviderConfig } from '@gauzy/contracts';
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, In, Repository } from 'typeorm';
import { indexBy, keys, object, pluck } from 'underscore';
import * as AWS from 'aws-sdk';
import { TenantAwareCrudService } from './../../core/crud';
import { TenantSetting } from './tenant-setting.entity';

@Injectable()
export class TenantSettingService extends TenantAwareCrudService<TenantSetting> {
	constructor(
		@InjectRepository(TenantSetting)
		private readonly tenantSettingRepository: Repository<TenantSetting>
	) {
		super(tenantSettingRepository);
	}

	async get(request?: FindManyOptions) {
		const settings: TenantSetting[] = await this.tenantSettingRepository.find(
			request
		);
		return object(pluck(settings, 'name'), pluck(settings, 'value'));
	}

	async saveSettngs(
		input: ITenantSetting,
		tenantId: string
	): Promise<ITenantSetting> {

		const settingsName = keys(input);
		const settings: TenantSetting[] = await this.tenantSettingRepository.find(
			{
				where: {
					name: In(settingsName),
					tenantId
				}
			}
		);

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

		await this.tenantSettingRepository.save(saveInput);
		return object(
			pluck(saveInput, 'name'),
			pluck(saveInput, 'value')
		);
	}

	// Verify connection configuration
	public async verifyWasabiConfiguration(entity: IWasabiFileStorageProviderConfig) {
		try {
			// Create S3 wasabi endpoint
			const endpoint = new AWS.Endpoint(entity.wasabi_aws_service_url);

			// Create S3 client service object
			const s3Client = new AWS.S3({
				accessKeyId: entity.wasabi_aws_access_key_id,
				secretAccessKey: entity.wasabi_aws_secret_access_key,
				region: entity.wasabi_aws_default_region,
				endpoint: endpoint
			});

			// Create the parameters for calling createBucket
			const params = {
				Bucket: entity.wasabi_aws_bucket
			};
			
			return await new Promise<void | any>((resolve, reject) => {
				// call S3 to create the bucket
				s3Client.createBucket(params, async (error: AWS.AWSError, data: AWS.S3.CreateBucketOutput) => {
					if (error) {
						reject({
							status: error.statusCode,
							message: error.message,
							error: error
						});
					} else {
						resolve({
							status: HttpStatus.CREATED,
							message: `${entity.wasabi_aws_bucket} is created succesfully in ${entity.wasabi_aws_default_region}`,
							data
						});
					}
				});
			});
		} catch (error) {
			throw new BadRequestException(error);
		}		
	}
}
