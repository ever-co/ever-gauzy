import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { CandidateSkillController } from './candidate-skill.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateSkill])],
	providers: [CandidateSkillService],
	controllers: [CandidateSkillController],
	exports: [CandidateSkillService]
})
export class CandidateSkillModule {}
