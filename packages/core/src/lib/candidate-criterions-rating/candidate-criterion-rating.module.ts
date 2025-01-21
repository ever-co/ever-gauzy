import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRatingController } from './candidate-criterion-rating.controller';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmCandidateCriterionsRatingRepository } from './repository/type-orm-candidate-criterions-rating.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateCriterionsRating]),
		MikroOrmModule.forFeature([CandidateCriterionsRating]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [CandidateCriterionsRatingService, TypeOrmCandidateCriterionsRatingRepository, ...CommandHandlers],
	controllers: [CandidateCriterionsRatingController]
})
export class CandidateCriterionsRatingModule {}
