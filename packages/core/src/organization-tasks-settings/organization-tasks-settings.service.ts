import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationTasksSettings } from './organization-tasks-settings.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrganizationTasksSettingsService extends TenantAwareCrudService<OrganizationTasksSettings> {
	constructor(
		@InjectRepository(OrganizationTasksSettings)
		private readonly organizationTasksSettingsRepository: Repository<OrganizationTasksSettings>
	) {
		super(organizationTasksSettingsRepository);
	}
}
