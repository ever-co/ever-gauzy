import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from './../tenant/tenant.module';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRatingController } from './candidate-criterion-rating.controller';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/candidate-criterions-rating',
				module: CandidateCriterionsRatingModule
			}
		]),
		TypeOrmModule.forFeature([ CandidateCriterionsRating ]),
		TenantModule,
		CqrsModule
	],
	providers: [CandidateCriterionsRatingService, ...CommandHandlers],
	controllers: [CandidateCriterionsRatingController],
	exports: [CandidateCriterionsRatingService]
})
export class CandidateCriterionsRatingModule {}
