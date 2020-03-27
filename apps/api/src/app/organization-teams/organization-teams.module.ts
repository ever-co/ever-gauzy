import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationTeams } from './organization-teams.entity';
import { OrganizationTeamsController } from './organization-teams.controller';
import { OrganizationTeamsService } from './organization-teams.service';
import { Employee } from '../employee/employee.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationTeams, Employee, User])],
	controllers: [OrganizationTeamsController],
	providers: [OrganizationTeamsService, UserService],
	exports: [OrganizationTeamsService]
})
export class OrganizationTeamsModule {}
