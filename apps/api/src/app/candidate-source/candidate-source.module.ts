import { Module } from '@nestjs/common';
import { CandidateSourceService } from './candidate-source.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateSource } from './candidate-source.entity';
import { CandidateSourceController } from './candidate-source.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateSource])],
	providers: [CandidateSourceService],
	controllers: [CandidateSourceController],
	exports: [CandidateSourceService]
})
export class CandidateSourceModule {}
