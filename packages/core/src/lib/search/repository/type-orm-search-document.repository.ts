import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchDocument } from '../search-document.entity';

/**
 * The TypeORM side of the search-document table.
 *
 * The repository is where the built-in database provider's dialect-specific query paths live: the
 * portable one every dialect serves, and the full-text one Postgres and MySQL serve better.
 */
@Injectable()
export class TypeOrmSearchDocumentRepository extends Repository<SearchDocument> {
	constructor(@InjectRepository(SearchDocument) readonly repository: Repository<SearchDocument>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
