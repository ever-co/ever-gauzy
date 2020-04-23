import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateDocumentsService } from './candidate-documents.service';
import { CandidateDocument } from './candidate-documents.entity';

@ApiTags('candidate_documents')
@Controller()
export class CandidateDocumentsController extends CrudController<
	CandidateDocument
> {
	constructor(
		private readonly candidateDocumentsService: CandidateDocumentsService
	) {
		super(candidateDocumentsService);
	}
}
