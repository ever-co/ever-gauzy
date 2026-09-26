import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeRecentVisit } from './employee-recent-visit.entity';
import { EmployeeRecentVisitService } from './employee-recent-visit.service';
import { EmployeeRecentVisitController } from './employee-recent-visit.controller';
import { EmployeeRecentVisitResolver } from './employee-recent-visit.resolver';
import { EventHandlers } from './events/handlers';
import { TypeOrmEmployeeRecentVisitRepository } from './repository/type-orm-employee-recent-visit.repository';
import { MikroOrmEmployeeRecentVisitRepository } from './repository/mikro-orm-employee-recent-visit.repository';

/**
 * The recent-visit history.
 *
 * The GraphQL view of the same resource is declared here, beside the service it calls, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach. It
 * injects the service, which this module already provides and exports — the module is global as well,
 * so the field is reachable wherever the endpoint is hosted without a second edge — and it injects
 * nothing beside it: this resource has one read and no write, so no command bus and no second service
 * is involved.
 */
@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeRecentVisit]),
		MikroOrmModule.forFeature([EmployeeRecentVisit]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [EmployeeRecentVisitController],
	providers: [
		EmployeeRecentVisitService,
		// The GraphQL view of the same resource.
		EmployeeRecentVisitResolver,
		TypeOrmEmployeeRecentVisitRepository,
		MikroOrmEmployeeRecentVisitRepository,
		...EventHandlers
	],
	exports: [EmployeeRecentVisitService, TypeOrmEmployeeRecentVisitRepository, MikroOrmEmployeeRecentVisitRepository]
})
export class EmployeeRecentVisitModule {}