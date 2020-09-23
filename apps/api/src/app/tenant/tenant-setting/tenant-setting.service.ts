import { ITenantSetting } from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

	async saveSettngs(input: ITenantSetting): Promise<ITenantSetting> {
		const settingsName = _.values(input);
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
							key,
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
