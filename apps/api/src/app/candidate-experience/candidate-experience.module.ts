import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateExperience } from './candidate-experience.entity';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperienceController } from './candidate-experience.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateExperience])],
	providers: [CandidateExperienceService],
	controllers: [CandidateExperienceController],
	exports: [CandidateExperienceService]
})
export class CandidateExperienceModule {}
