import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateDocument } from '../candidate-documents.entity';

@Injectable()
export class TypeOrmCandidateDocumentRepository extends Repository<CandidateDocument> {
    constructor(@InjectRepository(CandidateDocument) readonly repository: Repository<CandidateDocument>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
