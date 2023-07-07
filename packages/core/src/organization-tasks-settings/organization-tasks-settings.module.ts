import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { OrganizationTasksSettingsController } from './organization-tasks-settings.controller';
import { OrganizationTasksSettingsService } from './organization-tasks-settings.service';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationTasksSettings } from './organization-tasks-settings.entity';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-tasks-settings',
				module: OrganizationTasksSettingsModule,
			},
		]),
		TypeOrmModule.forFeature([OrganizationTasksSettings]),
		CqrsModule,
		TenantModule,
	],
	controllers: [OrganizationTasksSettingsController],
	providers: [OrganizationTasksSettingsService],
})
export class OrganizationTasksSettingsModule {}
