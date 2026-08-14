import { TypeOrmDocumentRepository } from './type-orm-document.repository';
import { TypeOrmDocumentCategoryRepository } from './type-orm-document-category.repository';
import { TypeOrmDocumentChunkRepository } from './type-orm-document-chunk.repository';
import { TypeOrmDocumentIndexStateRepository } from './type-orm-document-index-state.repository';
import { TypeOrmDocumentLinkRepository } from './type-orm-document-link.repository';
import { TypeOrmDocumentShareRepository } from './type-orm-document-share.repository';
import { TypeOrmDocumentVersionRepository } from './type-orm-document-version.repository';
import { TypeOrmDocumentInboundAddressRepository } from './type-orm-document-inbound-address.repository';

export * from './mikro-orm-document.repository';
export * from './mikro-orm-document-category.repository';
export * from './mikro-orm-document-chunk.repository';
export * from './mikro-orm-document-index-state.repository';
export * from './mikro-orm-document-link.repository';
export * from './mikro-orm-document-share.repository';
export * from './mikro-orm-document-version.repository';
export * from './mikro-orm-document-inbound-address.repository';
export * from './type-orm-document.repository';
export * from './type-orm-document-category.repository';
export * from './type-orm-document-chunk.repository';
export * from './type-orm-document-index-state.repository';
export * from './type-orm-document-link.repository';
export * from './type-orm-document-share.repository';
export * from './type-orm-document-version.repository';
export * from './type-orm-document-inbound-address.repository';

/**
 * TypeORM repository providers registered in `DocsModule`.
 * (The MikroORM repositories are instantiated by MikroORM itself through the
 * `mikroOrmRepository` entity option — they are not Nest providers.)
 */
export const TypeOrmRepositories = [
	TypeOrmDocumentRepository,
	TypeOrmDocumentCategoryRepository,
	TypeOrmDocumentVersionRepository,
	TypeOrmDocumentChunkRepository,
	TypeOrmDocumentIndexStateRepository,
	TypeOrmDocumentShareRepository,
	TypeOrmDocumentLinkRepository,
	TypeOrmDocumentInboundAddressRepository
];
