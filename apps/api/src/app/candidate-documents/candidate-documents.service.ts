import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateDocument } from './candidate-documents.entity';

@Injectable()
export class CandidateDocumentsService extends CrudService<CandidateDocument> {
	constructor(
		@InjectRepository(CandidateDocument)
		private readonly candidateDocumentRepository: Repository<
			CandidateDocument
		>
	) {
		super(candidateDocumentRepository);
	}
}
