import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { RoleModule } from '../role/role.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { OrganizationProjectModule } from '../organization-project/organization-project.module';
import { OrganizationStrategicInitiative } from './organization-strategic-initiative.entity';
import { OrganizationStrategicInitiativeService } from './organization-strategic-initiative.service';
import { OrganizationStrategicInitiativeController } from './organization-strategic-initiative.controller';
import { OrganizationStrategicInitiativeResolver } from './organization-strategic-initiative.resolver';
import { TypeOrmOrganizationStrategicInitiativeRepository } from './repository/type-orm-organization-strategic-initiative.repository';
import { MikroOrmOrganizationStrategicInitiativeRepository } from './repository/mikro-orm-organization-strategic-initiative.repository';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

/**
 * The directions an organization has decided to move in.
 *
 * `CqrsModule` is re-exported, not merely imported, because the GraphQL view of the same resource
 * dispatches the same commands and queries the delivered routes do — the create, the edit and the
 * signals assessment are commands, and the three reads are queries. A resolver is a provider of
 * whichever module hosts the resolver graph, so the module that hosts it reaches the two buses only if
 * this module hands them on; the service is exported for the two lifecycle fields beside them.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationStrategicInitiative]),
		MikroOrmModule.forFeature([OrganizationStrategicInitiative]),
		CqrsModule,
		RolePermissionModule,
		EmployeeModule,
		RoleModule,
		OrganizationTeamEmployeeModule,
		OrganizationProjectModule
	],
	controllers: [OrganizationStrategicInitiativeController],
	providers: [
		OrganizationStrategicInitiativeService,
		// The GraphQL view of the same resource.
		OrganizationStrategicInitiativeResolver,
		TypeOrmOrganizationStrategicInitiativeRepository, MikroOrmOrganizationStrategicInitiativeRepository,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [OrganizationStrategicInitiativeService, CqrsModule, TypeOrmOrganizationStrategicInitiativeRepository, MikroOrmOrganizationStrategicInitiativeRepository]
})
export class OrganizationStrategicInitiativeModule {}