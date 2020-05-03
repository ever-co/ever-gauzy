import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
@Module({
	imports: [TypeOrmModule.forFeature([CandidateFeedback])],
	providers: [CandidateFeedbacksService],
	controllers: [CandidateFeedbacksController],
	exports: [CandidateFeedbacksService]
})
export class CandidateFeedbacksModule {}
