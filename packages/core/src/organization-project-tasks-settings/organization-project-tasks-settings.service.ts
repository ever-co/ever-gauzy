import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationProjectTasksSettings } from './organization-project-tasks-settings.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrganizationProjectTasksSettingsService extends TenantAwareCrudService<OrganizationProjectTasksSettings> {
	constructor(
		@InjectRepository(OrganizationProjectTasksSettings)
		private readonly organizationProjectTasksSettingsRepository: Repository<OrganizationProjectTasksSettings>
	) {
		super(organizationProjectTasksSettingsRepository);
	}
}
