import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { combineLatest } from 'rxjs';
import { PluginSettingsRegistryService } from '@gauzy/plugin-ui';
import { AgentPageBridgeService, ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatAvailabilityService } from './ai-chat-availability.service';
import { AiChatSidebarComponent } from './ai-chat-sidebar.component';
import { GAUZY_PAGE_REGISTRY } from './page-registry';

/** Plugin id passed to `defineDeclarativePlugin` — the key its settings are registered under. */
export const AI_CHAT_REACT_UI_PLUGIN_ID = 'ai-chat-react-ui';

/**
 * Registers the AI Chat panel as a dedicated sidebar rendered
 * in the layout's chat sidebar slot (between the menu sidebar
 * and the main content area): `Menu | Chat | Page content`.
 *
 * Also:
 * - seeds the agent page registry (pages the agent may open in the canvas);
 * - keeps `ChatSidebarService.available` in sync with the verdict of
 *   {@link AiChatAvailabilityService} (permission + `GET /api/ai-chat/config`)
 *   — the layout and the header toggle only show the chat when it is true;
 * - honors the plugin's own "Enable AI Chat" (`chatEnabled`) setting on top of
 *   that verdict.
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
		const pluginSettings = inject(PluginSettingsRegistryService);

		// Open by default: the assistant is meant to be present from the first
		// paint, not discovered. Only applies to users with NO stored preference —
		// the service resolves server state (`user.uiPreferences.aiChat`) first,
		// then the browser's local mirror, and only then this default.
		chatSidebar.register({
			loadComponent: () => AiChatSidebarComponent,
			class: 'ai-chat-sidebar',
			defaultExpanded: true
		});

		pageBridge.registerPages(GAUZY_PAGE_REGISTRY);

		// Lives for the lifetime of the app (environment injector) — the chat
		// availability must keep tracking login/permission/credential changes.
		// The plugin setting can only switch the chat OFF: `undefined` (settings not
		// registered yet) counts as its declared default, on.
		combineLatest([
			availability.status$,
			pluginSettings.getValue$<boolean>(AI_CHAT_REACT_UI_PLUGIN_ID, 'chatEnabled')
		]).subscribe(([status, chatEnabled]) => chatSidebar.setAvailable(status.available && chatEnabled !== false));
	});
}
