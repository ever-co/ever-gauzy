import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule, TenantSettingModule } from '@gauzy/core';
import { SchedulerModule } from '@gauzy/scheduler';
import { CommandHandlers } from './commands/handlers';
import { Controllers } from './controllers';
import { ALL_DOC_ENTITIES } from './entities';
import { DocsAiService } from './knowledge/ai/docs-ai.service';
import { DocsChatToolsService } from './knowledge/chat-tools/docs-chat-tools.service';
import { DOCS_KNOWLEDGE_SEARCH_SERVICE } from './knowledge/chat-tools/docs-knowledge-search.types';
import { DocumentClassifierService } from './knowledge/classification/document-classifier.service';
import { EmbeddingService } from './knowledge/embedding/embedding.service';
import { ExtractionProviders } from './knowledge/extraction';
import { DocumentIndexService } from './knowledge/indexing/document-index.service';
import { DOCS_PROCESSING_QUEUE } from './knowledge/queue/constants';
import { DocsProcessingWorker } from './knowledge/queue/docs-processing.worker';
import { DocsQueueService } from './knowledge/queue/docs-queue.service';
import { DocsRecoveryService } from './knowledge/queue/docs-recovery.service';
import { DocumentKnowledgeSearchService } from './knowledge/retrieval/retrieval.service';
import { LexicalStoreProvider } from './knowledge/vector-store/providers/lexical.provider';
import { PgVectorStoreProvider } from './knowledge/vector-store/providers/pgvector.provider';
import { DocumentVectorStoreRegistry } from './knowledge/vector-store/vector-store.registry';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmRepositories } from './repositories';
import { Services } from './services';

/** The AI-knowledge providers of the plugin (classification, embedding, indexing, retrieval). */
const KnowledgeProviders = [
	DocsAiService,
	DocumentClassifierService,
	EmbeddingService,
	DocumentIndexService,
	DocumentKnowledgeSearchService,
	PgVectorStoreProvider,
	LexicalStoreProvider
];

@Module({
	imports: [
		TypeOrmModule.forFeature([...ALL_DOC_ENTITIES]),
		MikroOrmModule.forFeature([...ALL_DOC_ENTITIES]),
		RolePermissionModule, // required for TenantPermissionGuard/PermissionGuard resolution
		TenantSettingModule, // org defaults persist as namespaced tenant_setting rows
		CqrsModule,
		// Registers the `docs-processing` BullMQ queue against the core Redis connection;
		// the worker host + `@ScheduledJob` reconcile are ordinary providers below.
		SchedulerModule.forFeature({ queues: [DOCS_PROCESSING_QUEUE] })
	],
	controllers: [...Controllers],
	// The subscribers are registered globally through the `@Plugin({ subscribers })` metadata —
	// they must observe saves regardless of which module performs them.
	providers: [
		...Services,
		...ExtractionProviders,
		...KnowledgeProviders,
		...TypeOrmRepositories,
		...CommandHandlers,
		...QueryHandlers,
		DocsQueueService,
		DocsProcessingWorker,
		DocsRecoveryService,
		// Registers docs_search / docs_read with the AI chat engine's tool registry
		// (no-op when @gauzy/plugin-ai-chat is absent or GAUZY_DOCS_AI_ENABLED is false).
		DocsChatToolsService,
		// The chat tools consume the retrieval service through this optional token.
		{ provide: DOCS_KNOWLEDGE_SEARCH_SERVICE, useExisting: DocumentKnowledgeSearchService }
	],
	exports: [
		...Services,
		...ExtractionProviders,
		...KnowledgeProviders,
		DocsQueueService,
		DocsRecoveryService
	]
})
export class DocsModule implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(DocsModule.name);

	constructor(
		private readonly pgVectorStoreProvider: PgVectorStoreProvider,
		private readonly lexicalStoreProvider: LexicalStoreProvider
	) {}

	/**
	 * Registers the built-in vector-store providers. Order matters: `pgvector` first (the
	 * preferred store when available), `lexical` last (the always-available floor).
	 * Third-party stores register additional providers via the exported
	 * `DocumentVectorStoreRegistry`.
	 */
	onModuleInit(): void {
		DocumentVectorStoreRegistry.register(this.pgVectorStoreProvider);
		DocumentVectorStoreRegistry.register(this.lexicalStoreProvider);
		this.logger.log('Documents vector-store providers registered (pgvector, lexical).');
	}

	onModuleDestroy(): void {
		DocumentVectorStoreRegistry.unregister(this.pgVectorStoreProvider.id);
		DocumentVectorStoreRegistry.unregister(this.lexicalStoreProvider.id);
	}
}
