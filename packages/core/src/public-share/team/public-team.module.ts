import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationTeam } from './../../core/entities/internal';
import { PublicTeamController } from './public-team.controller';
import { PublicTeamService } from './public-team.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([OrganizationTeam]),
	],
	controllers: [
		PublicTeamController
	],
	providers: [
		PublicTeamService,
		...QueryHandlers
	],
	exports: []
})
export class PublicTeamModule { }
