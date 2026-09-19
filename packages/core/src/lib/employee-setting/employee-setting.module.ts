import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { EmployeeSetting } from './employee-setting.entity';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSettingController } from './employee-setting.controller';
import { EmployeeSettingResolver } from './employee-setting.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmployeeSettingRepository } from './repository/type-orm-employee-setting.repository';
import { MikroOrmEmployeeSettingRepository } from './repository/mikro-orm-employee-setting.repository';

/**
 * The employee setting.
 *
 * `EmployeeSettingResolver` is declared beside the controller, because a resolver is a provider of
 * whichever module hosts the handler the Apollo configuration names, and a provider can only inject
 * what its own module can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported, and the service is exported beside it.** The
 * host module imports this one and hosts the resolver, so it receives what this module hands on and
 * nothing else: without the command bus the resolver's two command dispatches would fail the boot
 * with an unresolved dependency, and without the service the two reads and the three direct writes
 * would. The REST controller beside it resolves both from this module's own imports, which is why
 * nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeSetting]),
		MikroOrmModule.forFeature([EmployeeSetting]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [EmployeeSettingController],
	providers: [
		EmployeeSettingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EmployeeSettingResolver,
		TypeOrmEmployeeSettingRepository,
		MikroOrmEmployeeSettingRepository,
		...CommandHandlers
	],
	exports: [EmployeeSettingService, CqrsModule]
})
export class EmployeeSettingModule {}
