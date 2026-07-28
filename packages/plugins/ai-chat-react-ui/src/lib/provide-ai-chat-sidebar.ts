import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { AgentPageBridgeService, ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatAvailabilityService } from './ai-chat-availability.service';
import { AiChatSidebarComponent } from './ai-chat-sidebar.component';
import { GAUZY_PAGE_REGISTRY } from './page-registry';

/**
 * Registers the AI Chat panel as a dedicated sidebar rendered
 * in the layout's chat sidebar slot (between the menu sidebar
 * and the main content area): `Menu | Chat | Page content`.
 *
 * Also:
 * - seeds the agent page registry (pages the agent may open in the canvas);
 * - keeps `ChatSidebarService.available` in sync with the verdict of
 *   {@link AiChatAvailabilityService} (permission + `GET /api/ai-chat/config`)
 *   — the layout and the header toggle only show the chat when it is true.
 *
 * The verdict deliberately lives in a shared service rather than here: the
 * "AI Providers" settings page reads the very same verdict to explain the chat
 * to the user, and forces a re-evaluation after a credential changes so the
 * first configured provider turns the chat on without a page reload.
 *
 * @example
 * ```typescript
 * providers: [provideAiChatSidebar()]
 * ```
 */
export function provideAiChatSidebar(): EnvironmentProviders {
	return provideEnvironmentInitializer(() => {
		const chatSidebar = inject(ChatSidebarService);
		const pageBridge = inject(AgentPageBridgeService);
		const availability = inject(AiChatAvailabilityService);

		chatSidebar.register({
			loadComponent: () => AiChatSidebarComponent,
			class: 'ai-chat-sidebar',
			defaultExpanded: false
		});

		pageBridge.registerPages(GAUZY_PAGE_REGISTRY);

		// Lives for the lifetime of the app (environment injector) — the chat
		// availability must keep tracking login/permission/credential changes.
		availability.status$.subscribe((status) => chatSidebar.setAvailable(status.available));
	});
}
