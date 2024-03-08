import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { CandidateSkillController } from './candidate-skill.controller';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-skills', module: CandidateSkillModule }]),
		TypeOrmModule.forFeature([CandidateSkill]),
		MikroOrmModule.forFeature([CandidateSkill]),
		RolePermissionModule
	],
	providers: [CandidateSkillService],
	controllers: [CandidateSkillController],
	exports: [CandidateSkillService]
})
export class CandidateSkillModule { }
