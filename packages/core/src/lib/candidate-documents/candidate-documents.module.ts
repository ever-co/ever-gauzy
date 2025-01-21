import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateDocumentsController } from './candidate-documents.controller';
import { CandidateDocument } from './candidate-documents.entity';
import { CandidateDocumentsService } from './candidate-documents.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateDocumentRepository } from './repository/type-orm-candidate-document.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateDocument]),
		MikroOrmModule.forFeature([CandidateDocument]),
		RolePermissionModule
	],
	controllers: [CandidateDocumentsController],
	providers: [CandidateDocumentsService, TypeOrmCandidateDocumentRepository]
})
export class CandidateDocumentsModule {}
