import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateInterviewService } from './candidate-interview.service';
import { CandidateInterviewController } from './candidate-interview.controller';
import { CandidateInterview } from './candidate-interview.entity';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateInterview])],
	providers: [CandidateInterviewService],
	controllers: [CandidateInterviewController],
	exports: [CandidateInterviewService]
})
export class CandidateInterviewModule {}
