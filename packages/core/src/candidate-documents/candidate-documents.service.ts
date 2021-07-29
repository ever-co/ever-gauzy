import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateDocument } from './candidate-documents.entity';

@Injectable()
export class CandidateDocumentsService extends TenantAwareCrudService<CandidateDocument> {
	constructor(
		@InjectRepository(CandidateDocument)
		private readonly candidateDocumentRepository: Repository<CandidateDocument>
	) {
		super(candidateDocumentRepository);
	}
}
