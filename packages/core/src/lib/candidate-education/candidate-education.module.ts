import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateEducationService } from './candidate-education.service';
import { CandidateEducation } from './candidate-education.entity';
import { CandidateEducationController } from './candidate-education.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateEducationRepository } from './repository/type-orm-candidate-education.repository';
import { MikroOrmCandidateEducationRepository } from './repository/mikro-orm-candidate-education.repository';

/**
 * The courses of study a candidacy filed.
 *
 * The service is exported because the GraphQL view of these rows is hosted by the module that owns the
 * candidacy: the five rows a candidate's file is made of are one shape and are served by one resolver,
 * `CandidateProfileResolver`, which `CandidateModule` declares — and a resolver can only inject what its
 * own module can reach. Nothing else is exported; the REST controller beside it resolves the service
 * from this module's own imports, which is what it always did.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateEducation]),
		MikroOrmModule.forFeature([CandidateEducation]),
		RolePermissionModule
	],
	controllers: [CandidateEducationController],
	providers: [CandidateEducationService, TypeOrmCandidateEducationRepository, MikroOrmCandidateEducationRepository],
	exports: [CandidateEducationService]
})
export class CandidateEducationModule {}