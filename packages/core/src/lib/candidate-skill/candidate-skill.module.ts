import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { CandidateSkillController } from './candidate-skill.controller';
import { TypeOrmCandidateSkillRepository } from './repository/type-orm-candidate-skill.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateSkill]),
		MikroOrmModule.forFeature([CandidateSkill]),
		RolePermissionModule
	],
	providers: [CandidateSkillService, TypeOrmCandidateSkillRepository],
	controllers: [CandidateSkillController]
})
export class CandidateSkillModule {}
