import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateSourceService } from './candidate-source.service';
import { CandidateSource } from './candidate-source.entity';
import { CandidateSourceController } from './candidate-source.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateSourceRepository } from './repository/type-orm-candidate-source.repository';
import { MikroOrmCandidateSourceRepository } from './repository/mikro-orm-candidate-source.repository';

/**
 * The origins a candidacy points at.
 *
 * The service is exported because the GraphQL view of these rows is hosted by the module that owns the
 * candidacy: the five rows a candidate's file is made of are one shape and are served by one resolver,
 * `CandidateProfileResolver`, which `CandidateModule` declares — and a resolver can only inject what its
 * own module can reach. Nothing else is exported; the REST controller beside it resolves the service
 * from this module's own imports, which is what it always did.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateSource]),
		MikroOrmModule.forFeature([CandidateSource]),
		RolePermissionModule
	],
	providers: [CandidateSourceService, TypeOrmCandidateSourceRepository, MikroOrmCandidateSourceRepository],
	controllers: [CandidateSourceController],
	exports: [CandidateSourceService]
})
export class CandidateSourceModule {}