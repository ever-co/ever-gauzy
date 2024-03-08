import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRatingController } from './candidate-criterion-rating.controller';
import { CommandHandlers } from './commands/handlers';

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
		RolePermissionModule,
		CqrsModule
	],
	providers: [CandidateCriterionsRatingService, ...CommandHandlers],
	controllers: [CandidateCriterionsRatingController],
	exports: [CandidateCriterionsRatingService]
})
export class CandidateCriterionsRatingModule { }
