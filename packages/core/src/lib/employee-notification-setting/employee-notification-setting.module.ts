import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';
import { EmployeeNotificationSettingController } from './employee-notification-setting.controller';
import { EmployeeNotificationSettingResolver } from './employee-notification-setting.resolver';
import { TypeOrmEmployeeNotificationSettingRepository } from './repository/type-orm-employee-notification-setting.repository';
import { MikroOrmEmployeeNotificationSettingRepository } from './repository/mikro-orm-employee-notification-setting.repository';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';

/**
 * The employee notification setting.
 *
 * `EmployeeNotificationSettingResolver` is declared beside the controller, because a resolver is a
 * provider of whichever module hosts the handler the Apollo configuration names, and a provider can
 * only inject what its own module can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported.** The host module imports this one and hosts the
 * resolver, so it receives what this module hands on and nothing else: without the command bus the
 * resolver's two command dispatches would fail the boot with an unresolved dependency. The service
 * beside it was already exported, so no second export was needed for it — the REST controller resolves
 * both from this module's own imports, which is why nothing needed re-exporting until the GraphQL view
 * of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeNotificationSetting]),
		MikroOrmModule.forFeature([EmployeeNotificationSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeNotificationSettingController],
	providers: [
		EmployeeNotificationSettingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EmployeeNotificationSettingResolver,
		TypeOrmEmployeeNotificationSettingRepository,
		MikroOrmEmployeeNotificationSettingRepository,
		...CommandHandlers
	],
	exports: [EmployeeNotificationSettingService, CqrsModule]
})
export class EmployeeNotificationSettingModule {}
