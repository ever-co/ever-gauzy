import { ITenantSetting } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, In, Repository } from 'typeorm';
import * as _ from 'underscore';
import { TenantAwareCrudService } from './../../core/crud';
import { TenantSetting } from './tenant-setting.entity';

@Injectable()
export class TenantSettingService extends TenantAwareCrudService<TenantSetting> {
	constructor(
		@InjectRepository(TenantSetting)
		private tenantSettingRepository: Repository<TenantSetting>
	) {
		super(tenantSettingRepository);
	}

	async get(request?: FindManyOptions) {
		const settings: TenantSetting[] = await this.tenantSettingRepository.find(
			request
		);
		return _.object(_.pluck(settings, 'name'), _.pluck(settings, 'value'));
	}

	async saveSettngs(
		input: ITenantSetting,
		tenantId: string
	): Promise<ITenantSetting> {

		const settingsName = _.keys(input);
		const settings: TenantSetting[] = await this.tenantSettingRepository.find(
			{
				where: {
					name: In(settingsName),
					tenantId
				}
			}
		);

		const settingsByName = _.indexBy(settings, 'name');
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
		return _.object(
			_.pluck(saveInput, 'name'),
			_.pluck(saveInput, 'value')
		);
	}
}
