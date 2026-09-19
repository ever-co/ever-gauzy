import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateExperience } from './candidate-experience.entity';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperienceController } from './candidate-experience.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateExperienceRepository } from './repository/type-orm-candidate-experience.repository';
import { MikroOrmCandidateExperienceRepository } from './repository/mikro-orm-candidate-experience.repository';

/**
 * The work a candidacy filed.
 *
 * The service is exported because the GraphQL view of these rows is hosted by the module that owns the
 * candidacy: the five rows a candidate's file is made of are one shape and are served by one resolver,
 * `CandidateProfileResolver`, which `CandidateModule` declares — and a resolver can only inject what its
 * own module can reach. Nothing else is exported; the REST controller beside it resolves the service
 * from this module's own imports, which is what it always did.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateExperience]),
		MikroOrmModule.forFeature([CandidateExperience]),
		RolePermissionModule
	],
	providers: [CandidateExperienceService, TypeOrmCandidateExperienceRepository, MikroOrmCandidateExperienceRepository],
	controllers: [CandidateExperienceController],
	exports: [CandidateExperienceService]
})
export class CandidateExperienceModule {}