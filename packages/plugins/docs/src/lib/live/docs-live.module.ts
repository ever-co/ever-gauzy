import { Module } from '@nestjs/common';
import { EventBusModule, GraphqlSubscriptionModule, RolePermissionModule } from '@gauzy/core';
import { DocsModule } from '../docs.module';
import { DocumentLiveController } from './document-live.controller';
import { DocumentLiveService } from './document-live.service';
import { DocsLiveResolver } from './graphql/docs-live.resolver';

/**
 * The live editing sessions of Docs pages, loaded only with `GAUZY_DOCS_LIVE_ENABLED=true` (`DocsLivePlugin`).
 *
 * It fills in `DocumentLiveBridge` of `DocsModule` when it starts, which is how the content save, the Markdown
 * update, the version restore, the duplicate and the share changes reach the live documents.
 */
@Module({
	imports: [
		DocsModule,
		// The core RxJS bus `DocumentEvent` travels on (the sessions re-check access on it); not global.
		EventBusModule,
		// The pub/sub the sessions stream on and the processes relay edits over.
		GraphqlSubscriptionModule,
		// The tenant and permission guards of the routes and the field.
		RolePermissionModule
	],
	controllers: [DocumentLiveController],
	providers: [
		DocumentLiveService,
		// Listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is never
		// registered, and the schema would advertise a field nothing resolves.
		DocsLiveResolver
	],
	exports: [DocumentLiveService]
})
export class DocsLiveModule {}
