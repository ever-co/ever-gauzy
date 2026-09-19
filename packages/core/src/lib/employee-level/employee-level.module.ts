import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeLevelController } from './employee-level.controller';
import { EmployeeLevelResolver } from './employee-level.resolver';
import { EmployeeLevelService } from './employee-level.service';
import { EmployeeLevel } from './employee-level.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmployeeLevelRepository } from './repository/type-orm-employee-level.repository';
import { MikroOrmEmployeeLevelRepository } from './repository/mikro-orm-employee-level.repository';

/**
 * The vocabulary an organization offers for employee seniority.
 *
 * **The resolver is declared here, beside the service it calls**, because a resolver is an ordinary
 * Nest provider and can only inject what the module hosting it can reach.
 *
 * **The service is exported, and that is what makes the resolver resolvable from the module the Apollo
 * configuration names.** A module's providers are private until it exports them, and the resolver's one
 * dependency is this module's service — so the module that hosts the resolver graph reaches it through
 * this export rather than by re-providing it and getting a second instance over the same table. Nothing
 * else is added: `CqrsModule` stays a plain import, because this resolver dispatches no command and the
 * two write fields reach the service directly, exactly as the routes beside them do.
 *
 * Both additions are wiring and nothing else: no route, entity, service or DTO changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeLevel]),
		MikroOrmModule.forFeature([EmployeeLevel]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeLevelController],
	providers: [
		EmployeeLevelService,
		// The GraphQL view of the same resource.
		EmployeeLevelResolver,
		TypeOrmEmployeeLevelRepository,
		MikroOrmEmployeeLevelRepository
	],
	exports: [EmployeeLevelService]
})
export class EmployeeLevelModule {}
