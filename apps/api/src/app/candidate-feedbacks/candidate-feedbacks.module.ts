import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { CandidateInterviewService } from '../candidate-interview/candidate-interview.service';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateFeedback, User, CandidateInterview]),
		CqrsModule
	],
	providers: [
		CandidateFeedbacksService,
		UserService,
		...CommandHandlers,
		CandidateInterviewService
	],
	controllers: [CandidateFeedbacksController],
	exports: [CandidateFeedbacksService]
})
export class CandidateFeedbacksModule {}
