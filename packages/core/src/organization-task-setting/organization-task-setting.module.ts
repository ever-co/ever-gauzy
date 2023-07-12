import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { OrganizationTaskSettingController } from './organization-task-setting.controller';
import { OrganizationTaskSettingService } from './organization-task-setting.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-task-setting',
				module: OrganizationTaskSettingModule,
			}
		]),
		TypeOrmModule.forFeature([
			OrganizationTaskSetting
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [OrganizationTaskSettingController],
	providers: [
		OrganizationTaskSettingService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		OrganizationTaskSettingService
	],
})
export class OrganizationTaskSettingModule {}
