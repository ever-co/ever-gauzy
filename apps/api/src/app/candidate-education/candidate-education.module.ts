import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateEducationService } from './candidate-education.service';
import { CandidateEducation } from './candidate-education.entity';
import { CandidateEducationController } from './candidate-education.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateEducation])],
	providers: [CandidateEducationService],
	controllers: [CandidateEducationController],
	exports: [CandidateEducationService]
})
export class CandidateEducationModule {}
