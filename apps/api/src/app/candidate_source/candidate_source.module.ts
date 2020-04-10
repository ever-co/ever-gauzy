import { Module } from '@nestjs/common';
import { CandidateSourceService } from './candidate_source.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateSource } from './candidate_source.entity';
import { CandidateSourceController } from './candidate_source.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateSource])],
	providers: [CandidateSourceService],
	controllers: [CandidateSourceController],
	exports: [CandidateSourceService]
})
export class CandidateSourceModule {}
