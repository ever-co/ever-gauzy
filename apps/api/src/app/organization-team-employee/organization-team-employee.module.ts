import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationTeamEmployee])],
	providers: [OrganizationTeamEmployeeService],
	exports: [OrganizationTeamEmployeeService]
})
export class OrganizationTeamEmployeeModule {}
