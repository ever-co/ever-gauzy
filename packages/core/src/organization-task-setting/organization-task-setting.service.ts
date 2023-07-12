import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrganizationTaskSettingService extends TenantAwareCrudService<OrganizationTaskSetting> {
	constructor(
		@InjectRepository(OrganizationTaskSetting)
		private readonly organizationTaskSettingRepository: Repository<OrganizationTaskSetting>
	) {
		super(organizationTaskSettingRepository);
	}
}
