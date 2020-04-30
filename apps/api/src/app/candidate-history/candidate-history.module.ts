import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateHistoryController } from './candidate-history.controller';
import { CandidateHistory } from './candidate-history.entity';
import { CandidateHistoryService } from './candidate-history.service';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateHistory])],
	providers: [CandidateHistoryService],
	controllers: [CandidateHistoryController],
	exports: [CandidateHistoryService]
})
export class CandidateHistoryModule {}
