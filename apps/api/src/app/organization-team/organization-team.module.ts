import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { Role } from '../role/role.entity';
import { RoleService } from '../role/role.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { OrganizationTeamController } from './organization-team.controller';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamService } from './organization-team.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			OrganizationTeam,
			Employee,
			User,
			Role,
			Organization
		]),
		OrganizationTeamEmployeeModule
	],
	controllers: [OrganizationTeamController],
	providers: [
		OrganizationTeamService,
		UserService,
		EmployeeService,
		RoleService,
		OrganizationService
	],
	exports: [OrganizationTeamService]
})
export class OrganizationTeamModule {}
