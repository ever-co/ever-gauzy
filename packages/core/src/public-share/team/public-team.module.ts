import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticModule } from './../../time-tracking/statistic';
import { OrganizationTeam } from './../../core/entities/internal';
import { PublicTeamController } from './public-team.controller';
import { PublicTeamService } from './public-team.service';
import { QueryHandlers } from './queries/handlers';
import { TimerModule } from 'time-tracking/timer/timer.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTeam]),
		MikroOrmModule.forFeature([OrganizationTeam]),
		CqrsModule,
		StatisticModule,
		TimerModule
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
