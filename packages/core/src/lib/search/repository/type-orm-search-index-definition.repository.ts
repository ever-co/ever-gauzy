import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchIndexDefinition } from '../search-index-definition.entity';

/**
 * The TypeORM side of the index-definition table.
 */
@Injectable()
export class TypeOrmSearchIndexDefinitionRepository extends Repository<SearchIndexDefinition> {
	constructor(@InjectRepository(SearchIndexDefinition) readonly repository: Repository<SearchIndexDefinition>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
