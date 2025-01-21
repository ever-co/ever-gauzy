import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateDocument } from './candidate-documents.entity';
import { TypeOrmCandidateDocumentRepository } from './repository/type-orm-candidate-document.repository';
import { MikroOrmCandidateDocumentRepository } from './repository/mikro-orm-candidate-document.repository';

@Injectable()
export class CandidateDocumentsService extends TenantAwareCrudService<CandidateDocument> {
	constructor(
		typeOrmCandidateDocumentsRepository: TypeOrmCandidateDocumentRepository,
		mikroOrmCandidateDocumentRepository: MikroOrmCandidateDocumentRepository
	) {
		super(typeOrmCandidateDocumentsRepository, mikroOrmCandidateDocumentRepository);
	}
}
