import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateDocumentsController } from './candidate-documents.controller';
import { CandidateDocument } from './candidate-documents.entity';
import { CandidateDocumentsService } from './candidate-documents.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateDocumentRepository } from './repository/type-orm-candidate-document.repository';
import { MikroOrmCandidateDocumentRepository } from './repository/mikro-orm-candidate-document.repository';

/**
 * The papers a candidacy filed.
 *
 * The service is exported because the GraphQL view of these rows is hosted by the module that owns the
 * candidacy: the five rows a candidate's file is made of are one shape and are served by one resolver,
 * `CandidateProfileResolver`, which `CandidateModule` declares — and a resolver can only inject what its
 * own module can reach. Nothing else is exported; the REST controller beside it resolves the service
 * from this module's own imports, which is what it always did.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateDocument]),
		MikroOrmModule.forFeature([CandidateDocument]),
		RolePermissionModule
	],
	controllers: [CandidateDocumentsController],
	providers: [CandidateDocumentsService, TypeOrmCandidateDocumentRepository, MikroOrmCandidateDocumentRepository],
	exports: [CandidateDocumentsService]
})
export class CandidateDocumentsModule {}