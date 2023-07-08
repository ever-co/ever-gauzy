import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { OrganizationProjectTasksSettingsController } from './organization-project-tasks-settings.controller';
import { OrganizationProjectTasksSettingsService } from './organization-project-tasks-settings.service';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationProjectTasksSettings } from './organization-project-tasks-settings.entity';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-project-tasks-settings',
				module: OrganizationProjectTasksSettingsModule,
			},
		]),
		TypeOrmModule.forFeature([OrganizationProjectTasksSettings]),
		CqrsModule,
		TenantModule,
	],
	controllers: [OrganizationProjectTasksSettingsController],
	providers: [OrganizationProjectTasksSettingsService, ...CommandHandlers],
	exports: [OrganizationProjectTasksSettingsService],
})
export class OrganizationProjectTasksSettingsModule {}
