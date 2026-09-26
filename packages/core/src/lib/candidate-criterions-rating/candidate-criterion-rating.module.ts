import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRatingController } from './candidate-criterion-rating.controller';
import { CandidateCriterionsRatingResolver } from './candidate-criterion-rating.resolver';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmCandidateCriterionsRatingRepository } from './repository/type-orm-candidate-criterions-rating.repository';
import { MikroOrmCandidateCriterionsRatingRepository } from './repository/mikro-orm-candidate-criterions-rating.repository';

/**
 * The rating a verdict gave to one of the things a sitting is assessed on.
 *
 * **The GraphQL view of the same resource is declared here, beside the service it calls.** The service is
 * already a provider, so its own dependency needed nothing new of the module; the command bus the three
 * bulk operations dispatch through did, and it is re-exported rather than merely imported: a module's
 * imports are not inherited by the module that imports it, so the module that hosts the resolver has to
 * reach the bus itself.
 *
 * The addition is one provider and one export. No provider, route or dependency changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateCriterionsRating]),
		MikroOrmModule.forFeature([CandidateCriterionsRating]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [
		CandidateCriterionsRatingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		CandidateCriterionsRatingResolver,
		TypeOrmCandidateCriterionsRatingRepository,
		MikroOrmCandidateCriterionsRatingRepository,
		...CommandHandlers
	],
	controllers: [CandidateCriterionsRatingController],
	exports: [CandidateCriterionsRatingService, CqrsModule]
})
export class CandidateCriterionsRatingModule {}