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
import { TypeOrmOrganizationStrategicInitiativeRepository } from './repository/type-orm-organization-strategic-initiative.repository';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

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
		TypeOrmOrganizationStrategicInitiativeRepository,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [OrganizationStrategicInitiativeService, TypeOrmOrganizationStrategicInitiativeRepository]
})
export class OrganizationStrategicInitiativeModule {}
