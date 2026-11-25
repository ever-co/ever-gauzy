import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { ChatSidebarService, PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { AiChatPageComponent } from './ai-chat-page.component';

/** Path segment of the full-page chat under `/pages` — `CHAT_FULL_PAGE_PATH` in `@gauzy/ui-core/core`. */
export const AI_CHAT_PAGE_PATH = 'ai-chat';

/**
 * Lets the full-page chat open without a server round trip when the chat is already known to be
 * available — `ChatSidebarService.available()` is only set once the plugin has checked
 * `AI_CHAT_ACCESS` and the backend configuration, which is exactly what Maximize needs. Otherwise
 * (a bookmark, a reload before that check finished) it asks the server like every other page.
 */
const aiChatPageGuard: CanActivateFn = (route, state) =>
	inject(ChatSidebarService).available() || inject(PermissionsGuard).canActivate(route, state);

/**
 * The full-page chat (`/pages/ai-chat`) — what the chat panel's Maximize opens.
 *
 * It lives INSIDE the `/pages` shell on purpose: a route outside it tears the whole shell down on
 * the way in (and re-runs the auth guards) and builds it again on the way back (the current user
 * with its relations, the menus, …), which is what made Maximize and Restore slow. Here only the
 * canvas page changes; the layout hides its menu, header and footer while this page is open (see
 * `ChatSidebarService.maximized`) and the page covers the screen.
 */
export const AI_CHAT_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'page-sections',
	path: AI_CHAT_PAGE_PATH,
	component: AiChatPageComponent,
	canActivate: [aiChatPageGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.AI_CHAT_ACCESS],
			redirectTo: '/pages/dashboard'
		}
	}
};
