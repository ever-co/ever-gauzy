import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateInterviewModule } from './../candidate-interview/candidate-interview.module';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-feedbacks', module: CandidateFeedbacksModule }]),
		TypeOrmModule.forFeature([CandidateFeedback]),
		MikroOrmModule.forFeature([CandidateFeedback]),
		RolePermissionModule,
		CandidateInterviewModule,
		CqrsModule
	],
	providers: [CandidateFeedbacksService, ...CommandHandlers],
	controllers: [CandidateFeedbacksController],
	exports: [CandidateFeedbacksService]
})
export class CandidateFeedbacksModule { }
