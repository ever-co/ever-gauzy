import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationTeamEmployee])]
})
export class OrganizationTeamEmployeeModule {}
