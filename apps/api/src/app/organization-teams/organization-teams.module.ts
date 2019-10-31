import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationTeams } from './organization-teams.entity';
import { OrganizationTeamsController } from './organization-teams.controller';
import { OrganizationTeamsService } from './organization-teams.service';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationTeams])],
	controllers: [OrganizationTeamsController],
	providers: [OrganizationTeamsService],
	exports: [OrganizationTeamsService]
})
export class OrganizationTeamsModule {}
