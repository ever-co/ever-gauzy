import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateInterviewModule } from './../candidate-interview/candidate-interview.module';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmCandidateFeedbackRepository } from './repository/type-orm-candidate-feedback.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateFeedback]),
		MikroOrmModule.forFeature([CandidateFeedback]),
		RolePermissionModule,
		CandidateInterviewModule,
		CqrsModule
	],
	providers: [CandidateFeedbacksService, TypeOrmCandidateFeedbackRepository, ...CommandHandlers],
	controllers: [CandidateFeedbacksController]
})
export class CandidateFeedbacksModule {}
