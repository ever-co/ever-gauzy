import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CandidateInterviewModule } from './../candidate-interview/candidate-interview.module';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/candidate-feedbacks', module: CandidateFeedbacksModule }
		]),
		TypeOrmModule.forFeature([ CandidateFeedback ]),
		TenantModule,
		UserModule,
		CandidateInterviewModule,
		CqrsModule
	],
	providers: [
		CandidateFeedbacksService,
		...CommandHandlers
	],
	controllers: [CandidateFeedbacksController],
	exports: [CandidateFeedbacksService]
})
export class CandidateFeedbacksModule {}