import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SearchDocument } from './search-document.entity';
import { SearchIndexDefinition } from './search-index-definition.entity';
import { TypeOrmSearchDocumentRepository } from './repository/type-orm-search-document.repository';
import { TypeOrmSearchIndexDefinitionRepository } from './repository/type-orm-search-index-definition.repository';
import { MikroOrmSearchDocumentRepository } from './repository/mikro-orm-search-document.repository';
import { MikroOrmSearchIndexDefinitionRepository } from './repository/mikro-orm-search-index-definition.repository';

/**
 * The storage half of global search.
 *
 * It owns the two tables and nothing else: what is searchable, how it is queried, which provider
 * answers and how the index is kept current are the search package's business, and a deployment with
 * that package absent still has these tables — unused, and breaking nothing.
 *
 * The module is registered with the application the same way every kernel module is, so the tables
 * exist for every domain before any package asks to be indexed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([SearchIndexDefinition, SearchDocument]),
		MikroOrmModule.forFeature([SearchIndexDefinition, SearchDocument])
	],
	providers: [
		TypeOrmSearchIndexDefinitionRepository,
		MikroOrmSearchIndexDefinitionRepository,
		TypeOrmSearchDocumentRepository,
		MikroOrmSearchDocumentRepository
	],
	exports: [
		TypeOrmSearchIndexDefinitionRepository,
		MikroOrmSearchIndexDefinitionRepository,
		TypeOrmSearchDocumentRepository,
		MikroOrmSearchDocumentRepository
	]
})
export class SearchModule {}
