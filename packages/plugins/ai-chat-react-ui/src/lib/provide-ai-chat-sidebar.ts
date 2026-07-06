import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { combineLatest, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { IAiChatConfig, PermissionsEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { AgentPageBridgeService, ChatSidebarService, Store } from '@gauzy/ui-core/core';
import { AiChatSidebarComponent } from './ai-chat-sidebar.component';
import { GAUZY_PAGE_REGISTRY } from './page-registry';

/**
 * Registers the AI Chat panel as a dedicated sidebar rendered
 * in the layout's chat sidebar slot (between the menu sidebar
 * and the main content area): `Menu | Chat | Page content`.
 *
 * Also:
 * - seeds the agent page registry (pages the agent may open in the canvas);
 * - keeps `ChatSidebarService.available` in sync with the user's
 *   `AI_CHAT_ACCESS` permission and the backend configuration
 *   (`GET /api/ai-chat/config`) — the layout and the header toggle only
 *   show the chat when both are satisfied.
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
		const store = inject(Store);
		const http = inject(HttpClient);

		chatSidebar.register({
			loadComponent: () => AiChatSidebarComponent,
			class: 'ai-chat-sidebar',
			defaultExpanded: false
		});

		pageBridge.registerPages(GAUZY_PAGE_REGISTRY);

		// Availability = logged in + AI_CHAT_ACCESS permission + backend configured.
		// Re-evaluated whenever the user or their role permissions change.
		combineLatest([store.user$, store.userRolePermissions$])
			.pipe(
				debounceTime(100),
				switchMap(([user, rolePermissions]) => {
					if (!user) return of(false);
					const permitted = (rolePermissions ?? []).some(
						(rolePermission: any) =>
							rolePermission.permission === PermissionsEnum.AI_CHAT_ACCESS && rolePermission.enabled
					);
					if (!permitted) return of(false);
					return http.get<IAiChatConfig>(`${environment.API_BASE_URL}/api/ai-chat/config`).pipe(
						map((config) => !!config?.enabled),
						catchError(() => of(false))
					);
				})
			)
			.subscribe((available) => chatSidebar.setAvailable(available));
	});
}
