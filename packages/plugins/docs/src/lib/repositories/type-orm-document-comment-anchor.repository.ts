import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentCommentAnchor } from '../entities/document-comment-anchor.entity';

@Injectable()
export class TypeOrmDocumentCommentAnchorRepository extends Repository<DocumentCommentAnchor> {
	constructor(@InjectRepository(DocumentCommentAnchor) readonly repository: Repository<DocumentCommentAnchor>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
