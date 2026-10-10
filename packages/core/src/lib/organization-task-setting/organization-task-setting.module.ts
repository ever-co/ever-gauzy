import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationTaskSettingController } from './organization-task-setting.controller';
import { OrganizationTaskSettingResolver } from './organization-task-setting.resolver';
import { OrganizationTaskSettingService } from './organization-task-setting.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmOrganizationTaskSettingRepository } from './repository/type-orm-organization-task-setting.repository';
import { MikroOrmOrganizationTaskSettingRepository } from './repository/mikro-orm-organization-task-setting.repository';

/**
 * The row that decides how the task tracker behaves inside one organization.
 *
 * `CqrsModule` is re-exported, not merely imported, because the GraphQL view of the same resource
 * dispatches the two writes as the commands the delivered routes dispatch. A resolver is a provider of
 * whichever module hosts the resolver graph, so the module that hosts it reaches the command bus only
 * if this module hands it on; the service is exported for the read beside them.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTaskSetting]),
		MikroOrmModule.forFeature([OrganizationTaskSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationTaskSettingController],
	providers: [OrganizationTaskSettingService, OrganizationTaskSettingResolver, TypeOrmOrganizationTaskSettingRepository, MikroOrmOrganizationTaskSettingRepository, ...CommandHandlers],
	exports: [OrganizationTaskSettingService, CqrsModule, TypeOrmOrganizationTaskSettingRepository, MikroOrmOrganizationTaskSettingRepository]
})
export class OrganizationTaskSettingModule {}