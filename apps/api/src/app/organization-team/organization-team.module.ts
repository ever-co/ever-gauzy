import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamController } from './organization-team.controller';
import { OrganizationTeamService } from './organization-team.service';
import { Employee } from '../employee/employee.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Role } from '../role/role.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTeam, Employee, User, Role])
	],
	controllers: [OrganizationTeamController],
	providers: [OrganizationTeamService, UserService],
	exports: [OrganizationTeamService]
})
export class OrganizationTeamModule {}
