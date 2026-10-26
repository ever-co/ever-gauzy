import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateInterviewModule } from './../candidate-interview/candidate-interview.module';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
import { CandidateFeedbacksResolver } from './candidate-feedbacks.resolver';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmCandidateFeedbackRepository } from './repository/type-orm-candidate-feedback.repository';
import { MikroOrmCandidateFeedbackRepository } from './repository/mikro-orm-candidate-feedback.repository';

/**
 * The panel's verdict on one sitting.
 *
 * **The GraphQL view of the same resource is declared here, beside the service it calls**, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach. The
 * service is already a provider, so its own dependency needed nothing new of the module; the command bus
 * the two write fields dispatch through did, and it is re-exported rather than merely imported: a
 * module's imports are not inherited by the module that imports it, so the module that hosts the
 * resolver has to reach the bus itself.
 *
 * The addition is one provider and one export. No provider, route or dependency changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateFeedback]),
		MikroOrmModule.forFeature([CandidateFeedback]),
		RolePermissionModule,
		CandidateInterviewModule,
		CqrsModule
	],
	providers: [
		CandidateFeedbacksService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		CandidateFeedbacksResolver,
		TypeOrmCandidateFeedbackRepository,
		MikroOrmCandidateFeedbackRepository,
		...CommandHandlers
	],
	controllers: [CandidateFeedbacksController],
	exports: [CandidateFeedbacksService, CqrsModule]
})
export class CandidateFeedbacksModule {}