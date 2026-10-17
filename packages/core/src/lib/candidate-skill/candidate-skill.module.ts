import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { CandidateSkillController } from './candidate-skill.controller';
import { TypeOrmCandidateSkillRepository } from './repository/type-orm-candidate-skill.repository';
import { MikroOrmCandidateSkillRepository } from './repository/mikro-orm-candidate-skill.repository';

/**
 * The skills a candidacy claims.
 *
 * The service is exported because the GraphQL view of these rows is hosted by the module that owns the
 * candidacy: the five rows a candidate's file is made of are one shape and are served by one resolver,
 * `CandidateProfileResolver`, which `CandidateModule` declares — and a resolver can only inject what its
 * own module can reach. Nothing else is exported; the REST controller beside it resolves the service
 * from this module's own imports, which is what it always did.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateSkill]),
		MikroOrmModule.forFeature([CandidateSkill]),
		RolePermissionModule
	],
	providers: [CandidateSkillService, TypeOrmCandidateSkillRepository, MikroOrmCandidateSkillRepository],
	controllers: [CandidateSkillController],
	exports: [CandidateSkillService]
})
export class CandidateSkillModule {}