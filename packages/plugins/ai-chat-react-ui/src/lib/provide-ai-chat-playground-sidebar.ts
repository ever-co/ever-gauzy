import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { ChatSidebarService } from '@gauzy/ui-core/core';
import { PlaygroundChatSidebarComponent } from './playground-chat-sidebar.component';

/**
 * Registers the AI Chat sidebar as a dedicated panel rendered
 * in the layout's chat sidebar slot (between the menu sidebar
 * and the main content area).
 *
 * Uses `ChatSidebarService` — a separate service from
 * `NavigationBuilderService` which handles right-side sidebars.
 *
 * @example
 * ```typescript
 * providers: [provideAiChatPlaygroundSidebar()]
 * ```
 */
export function provideAiChatPlaygroundSidebar(): EnvironmentProviders {
	return provideEnvironmentInitializer(() => {
		const chatSidebar = inject(ChatSidebarService);
		chatSidebar.register({
			loadComponent: () => PlaygroundChatSidebarComponent,
			class: 'ai-chat-sidebar'
		});
	});
}
