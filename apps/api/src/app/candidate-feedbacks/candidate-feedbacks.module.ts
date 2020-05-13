import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
@Module({
	imports: [TypeOrmModule.forFeature([CandidateFeedback, User])],
	providers: [CandidateFeedbacksService, UserService],
	controllers: [CandidateFeedbacksController],
	exports: [CandidateFeedbacksService]
})
export class CandidateFeedbacksModule {}
