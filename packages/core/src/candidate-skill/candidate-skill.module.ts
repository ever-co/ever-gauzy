import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { CandidateSkillController } from './candidate-skill.controller';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/candidate-skills', module: CandidateSkillModule }
		]),
		TypeOrmModule.forFeature([ CandidateSkill ]),
		TenantModule
	],
	providers: [CandidateSkillService],
	controllers: [CandidateSkillController],
	exports: [CandidateSkillService]
})
export class CandidateSkillModule {}
