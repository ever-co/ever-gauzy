import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule, FeatureModule, RolePermissionModule, TenantSettingModule } from '@gauzy/core';
import { SchedulerModule } from '@gauzy/scheduler';
import { ChatCaptureSubscriber } from './capture/chat-capture.subscriber';
import { isDocsQueueEnabled } from './docs.config';
import { GenericSignedWebhookAdapter } from './capture/generic-signed-webhook.adapter';
import { InboundEmailController } from './capture/inbound-email.controller';
import { InboundEmailService } from './capture/inbound-email.service';
import { DOCS_INBOUND_EMAIL_ADAPTER } from './capture/inbound-email.types';
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
import { DocsPipelineService } from './knowledge/queue/docs-pipeline.service';
import { DOCS_PIPELINE_RUNNER } from './knowledge/queue/docs-pipeline.types';
import { DocsProcessingWorker } from './knowledge/queue/docs-processing.worker';
import { DocsQueueService } from './knowledge/queue/docs-queue.service';
import { DocsRecoveryService } from './knowledge/queue/docs-recovery.service';
import { DocumentKnowledgeSearchService } from './knowledge/retrieval/retrieval.service';
import { LegacyImportController } from './legacy-import/legacy-import.controller';
import { LegacyImportService } from './legacy-import/legacy-import.service';
import { LexicalStoreProvider } from './knowledge/vector-store/providers/lexical.provider';
import { PgVectorStoreProvider } from './knowledge/vector-store/providers/pgvector.provider';
import { DocumentVectorStoreRegistry } from './knowledge/vector-store/vector-store.registry';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmRepositories } from './repositories';
import { Services } from './services';
import { RetrievalLogService } from './telemetry/retrieval-log.service';
import { DOCS_RETRIEVAL_LOG } from './telemetry/retrieval-log.types';

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

/**
 * Whether this process runs the BullMQ side of the pipeline (queue registration + worker host)
 * or dispatches every stage inline.
 *
 * Evaluated once, at module-definition time, because Nest module metadata is static.
 *
 * 🛑 The BullMQ pieces are GATED, not unconditional: `SchedulerModule.forRoot()` is imported
 * only by `apps/worker`, so in an API process there is no Bull root — `registerQueue()` would
 * still build a `Queue`/`Worker` pair against BullMQ's default `localhost:6379` and retry that
 * connection forever. `DocsQueueService` covers the gap by running stages in-process.
 */
const QUEUE_ENABLED = isDocsQueueEnabled();

@Module({
	imports: [
		TypeOrmModule.forFeature([...ALL_DOC_ENTITIES]),
		MikroOrmModule.forFeature([...ALL_DOC_ENTITIES]),
		RolePermissionModule, // required for TenantPermissionGuard/PermissionGuard resolution
		// Every controller here is `@UseGuards(..., FeatureFlagGuard)` + `@FeatureFlag(FEATURE_DOCUMENTS)`,
		// and that guard injects `FeatureService`. Without this import the guard cannot be constructed
		// and the whole API fails to bootstrap — guards are resolved from the DECLARING module's
		// injector, so importing the guard's class is not enough.
		FeatureModule,
		TenantSettingModule, // org defaults persist as namespaced tenant_setting rows
		EventBusModule, // provides the core RxJS EventBus that DocumentService publishes DocumentEvent on
		CqrsModule,
		// Registers the `docs-processing` BullMQ queue against the core Redis connection —
		// only where a scheduler root with queueing can exist (see `QUEUE_ENABLED`). The
		// `@ScheduledJob` reconcile is an ordinary provider below and is discovered by the
		// scheduler when one is present.
		...(QUEUE_ENABLED ? [SchedulerModule.forFeature({ queues: [DOCS_PROCESSING_QUEUE] })] : [])
	],
	// The legacy-import and inbound-email controllers are declared first: their static
	// `/migrations/...` and `/inbound-email` segments must never be swallowed by the generic
	// `/documents/:id` routes of the document controllers.
	controllers: [LegacyImportController, InboundEmailController, ...Controllers],
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
		// The ONE definition of every pipeline stage. Both dispatchers call it: the BullMQ
		// worker host (queue mode) and `DocsQueueService`'s inline runner (no-scheduler mode).
		DocsPipelineService,
		// Token indirection so `DocsQueueService` can resolve the runner lazily without
		// importing the class — the pipeline injects the queue service, so a direct dependency
		// would be a DI (and CommonJS require) cycle.
		{ provide: DOCS_PIPELINE_RUNNER, useExisting: DocsPipelineService },
		// Only meaningful with a BullMQ root — a `@Processor` registered without one opens a
		// stray Redis worker connection in every API process.
		...(QUEUE_ENABLED ? [DocsProcessingWorker] : []),
		DocsRecoveryService,
		// M4 consolidation: reads the legacy Organization-Documents / Help-Center tables
		// (from @gauzy/core and @gauzy/plugin-knowledge-base) strictly read-only.
		LegacyImportService,
		// Registers docs_search / docs_read with the AI chat engine's tool registry
		// (no-op when @gauzy/plugin-ai-chat is absent or GAUZY_DOCS_AI_ENABLED is false).
		DocsChatToolsService,
		// The chat tools consume the retrieval service through this optional token.
		{ provide: DOCS_KNOWLEDGE_SEARCH_SERVICE, useExisting: DocumentKnowledgeSearchService },
		// M5 telemetry groundwork (07 §16): structured-log sink today, table-backed in P2 —
		// the token is the swap point, no call site changes.
		RetrievalLogService,
		{ provide: DOCS_RETRIEVAL_LOG, useExisting: RetrievalLogService },
		// M5 capture channels (07 §17): inbound email (public signed webhook, disabled unless
		// GAUZY_DOCS_INBOUND_EMAIL_ENABLED=true) and AI-chat attachments (registered no-op
		// until the chat plugin exports its attachment event).
		GenericSignedWebhookAdapter,
		{ provide: DOCS_INBOUND_EMAIL_ADAPTER, useExisting: GenericSignedWebhookAdapter },
		InboundEmailService,
		ChatCaptureSubscriber
	],
	exports: [
		...Services,
		...ExtractionProviders,
		...KnowledgeProviders,
		DocsQueueService,
		DocsPipelineService,
		DocsRecoveryService,
		LegacyImportService,
		RetrievalLogService,
		DOCS_RETRIEVAL_LOG,
		InboundEmailService,
		ChatCaptureSubscriber
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
