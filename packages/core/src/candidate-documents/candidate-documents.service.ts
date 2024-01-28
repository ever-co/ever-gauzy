import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateDocument } from './candidate-documents.entity';

@Injectable()
export class CandidateDocumentsService extends TenantAwareCrudService<CandidateDocument> {
	constructor(
		@InjectRepository(CandidateDocument)
		candidateDocumentRepository: Repository<CandidateDocument>,
		@MikroInjectRepository(CandidateDocument)
		mikroCandidateDocumentRepository: EntityRepository<CandidateDocument>
	) {
		super(candidateDocumentRepository, mikroCandidateDocumentRepository);
	}
}
