import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import { CandidatePersonalQualitiesController } from './candidate-personal-qualities.controller';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/candidate-personal-qualities',
				module: CandidatePersonalQualitiesModule
			}
		]),
		TypeOrmModule.forFeature([ CandidatePersonalQualities ]),
		TenantModule,
		CqrsModule
	],
	providers: [
		CandidatePersonalQualitiesService,
		...CommandHandlers
	],
	controllers: [CandidatePersonalQualitiesController],
	exports: [TypeOrmModule, CandidatePersonalQualitiesService]
})
export class CandidatePersonalQualitiesModule {}
