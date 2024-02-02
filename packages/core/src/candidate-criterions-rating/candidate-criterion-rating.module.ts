import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from './../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRatingController } from './candidate-criterion-rating.controller';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/candidate-criterions-rating',
				module: CandidateCriterionsRatingModule
			}
		]),
		TypeOrmModule.forFeature([CandidateCriterionsRating]),
		MikroOrmModule.forFeature([CandidateCriterionsRating]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	providers: [CandidateCriterionsRatingService, ...CommandHandlers],
	controllers: [CandidateCriterionsRatingController],
	exports: [CandidateCriterionsRatingService]
})
export class CandidateCriterionsRatingModule { }
