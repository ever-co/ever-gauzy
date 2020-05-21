import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamController } from './organization-team.controller';
import { OrganizationTeamService } from './organization-team.service';
import { Employee } from '../employee/employee.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { EmployeeService } from '../employee/employee.service';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationTeam, Employee, User])],
	controllers: [OrganizationTeamController],
	providers: [OrganizationTeamService, UserService, EmployeeService],
	exports: [OrganizationTeamService]
})
export class OrganizationTeamModule {}
