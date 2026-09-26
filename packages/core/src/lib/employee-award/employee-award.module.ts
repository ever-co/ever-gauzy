import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeAward } from './employee-award.entity';
import { EmployeeAwardController } from './employee-award.controller';
import { EmployeeAwardResolver } from './employee-award.resolver';
import { EmployeeAwardService } from './employee-award.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmployeeAwardRepository } from './repository/type-orm-employee-award.repository';
import { MikroOrmEmployeeAwardRepository } from './repository/mikro-orm-employee-award.repository';

/**
 * The awards an organization records about its employees.
 *
 * **The resolver is declared here, beside the service it calls**, because a resolver is an ordinary
 * Nest provider and can only inject what the module hosting it can reach.
 *
 * **The service is exported, and that is what makes the resolver resolvable from the module the Apollo
 * configuration names.** A module's providers are private until it exports them, and the resolver's one
 * dependency is this module's service — so the module that hosts the resolver graph reaches it through
 * this export rather than by re-providing it and getting a second instance over the same table. Nothing
 * else is added to the exports: the repository pair stays this module's own business, and no other
 * module injects the service.
 *
 * Both additions are wiring and nothing else: no route, entity, service or DTO changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeAward]),
		MikroOrmModule.forFeature([EmployeeAward]),
		RolePermissionModule
	],
	controllers: [EmployeeAwardController],
	providers: [
		EmployeeAwardService,
		// The GraphQL view of the same resource.
		EmployeeAwardResolver,
		TypeOrmEmployeeAwardRepository,
		MikroOrmEmployeeAwardRepository
	],
	exports: [EmployeeAwardService]
})
export class EmployeeAwardModule {}
