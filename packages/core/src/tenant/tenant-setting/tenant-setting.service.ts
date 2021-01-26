import { ITenantSetting } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, In, Repository } from 'typeorm';
import { CrudService } from '../../core/crud';
import { TenantSetting } from './tenant-setting.entity';
import * as _ from 'underscore';
import { RequestContext } from '../../core/context';

@Injectable()
export class TenantSettingService extends CrudService<TenantSetting> {
	constructor(
		@InjectRepository(TenantSetting)
		private tenantSettingRepository: Repository<TenantSetting>
	) {
		super(tenantSettingRepository);
	}

	async get(requrst?: FindManyOptions) {
		const settings: TenantSetting[] = await this.tenantSettingRepository.find(
			requrst
		);
		return _.object(_.pluck(settings, 'name'), _.pluck(settings, 'value'));
	}

	async saveSettngs(input: ITenantSetting): Promise<ITenantSetting> {
		const settingsName = _.keys(input);

		const user = RequestContext.currentUser();
		const settings: TenantSetting[] = await this.tenantSettingRepository.find(
			{
				where: {
					name: In(settingsName),
					tenantId: user.tenantId
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
							tenantId: user.tenantId
						})
					);
				}
			}
		}

		this.tenantSettingRepository.save(saveInput);
		return _.object(
			_.pluck(saveInput, 'name'),
			_.pluck(saveInput, 'value')
		);
	}
}
