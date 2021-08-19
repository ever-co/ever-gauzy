import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { TenantModule } from './../tenant/tenant.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { AuthModule } from '../auth/auth.module';
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
		TypeOrmModule.forFeature([CandidateCriterionsRating]),
		TenantModule,
		UserModule,
		RoleModule,
		RolePermissionsModule,
		AuthModule,
		CqrsModule
	],
	providers: [CandidateCriterionsRatingService, ...CommandHandlers],
	controllers: [CandidateCriterionsRatingController],
	exports: [CandidateCriterionsRatingService]
})
export class CandidateCriterionsRatingModule {}
