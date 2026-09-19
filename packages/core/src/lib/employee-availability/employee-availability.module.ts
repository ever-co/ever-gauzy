import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { EmployeeAvailabilityController } from './employee-availability.controller';
import { EmployeeAvailabilityResolver } from './employee-availability.resolver';
import { EmployeeAvailability } from './employee-availability.entity';
import { TypeOrmEmployeeAvailabilityRepository } from './repository/type-orm-employee-availability.repository';
import { MikroOrmEmployeeAvailabilityRepository } from './repository/mikro-orm-employee-availability.repository';
import { RolePermissionModule } from '../role-permission/role-permission.module';

/**
 * Where an employee's availability lives.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is an ordinary provider, so it is declared once here — beside the
 * service it calls — and again by whichever module the Apollo configuration names, because that module
 * is what scans for resolvers. The second instance resolves its dependencies from its own module, so
 * this module has to hand on both the command bus the two write fields dispatch through and the service
 * the reads call. The REST controller beside it resolves the bus from this module's own imports, which
 * is why nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeAvailability]),
		MikroOrmModule.forFeature([EmployeeAvailability]),
		CqrsModule,
		// The permission guards the controller and the resolver carry are providers of whichever module
		// hosts the handler they protect, and their own dependency is the permission lookup — so this
		// module has to reach it. It went unnoticed while the module was in no graph at all: the routes
		// were not mounted and the resolver was not scanned, so nothing ever asked for the guard.
		RolePermissionModule
	],
	providers: [
		EmployeeAvailabilityService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EmployeeAvailabilityResolver,
		TypeOrmEmployeeAvailabilityRepository,
		MikroOrmEmployeeAvailabilityRepository,
		...CommandHandlers
	],
	controllers: [EmployeeAvailabilityController],
	exports: [EmployeeAvailabilityService, CqrsModule]
})
export class EmployeeAvailabilityModule {}
