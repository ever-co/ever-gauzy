import { inject } from '@angular/core';
import { CanActivateFn, ResolveFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { ChatSidebarService, PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { AiChatPageComponent } from './ai-chat-page.component';

/** Path segment of the full-page chat under `/pages` — `CHAT_FULL_PAGE_PATH` in `@gauzy/ui-core/core`. */
export const AI_CHAT_PAGE_PATH = 'ai-chat';

/**
 * Lets the full-page chat open without a server round trip when the chat is already known to be
 * available — `ChatSidebarService.available()` is only set once the plugin has checked
 * `AI_CHAT_ACCESS` and the backend configuration, which is exactly what this page needs. Otherwise
 * (a bookmark, a reload before that check finished) it asks the server like every other page.
 */
const aiChatPageGuard: CanActivateFn = (route, state) =>
	inject(ChatSidebarService).available() || inject(PermissionsGuard).canActivate(route, state);

/**
 * The tab title, in the app's language. The app has no title strategy that translates keys, so the
 * route resolves its own (as the Downloads page does); `get` waits for the language file if it is
 * still loading. AiChatPageComponent puts the previous title back when the page is left.
 */
const aiChatPageTitle: ResolveFn<string> = () => inject(TranslateService).get('AI_ASSISTANT.TITLE');

/**
 * The full-page chat (`/pages/ai-chat`) — a direct link to the chat on its own (a bookmark, the
 * `/ai-chat` redirect). The chat panel's Maximize does NOT navigate here: it expands the docked chat
 * in place, so the page underneath — and anything typed into it — stays alive.
 *
 * It lives INSIDE the `/pages` shell on purpose: a route outside it tears the whole shell down on
 * the way in (and re-runs the auth guards) and builds it again on the way back (the current user
 * with its relations, the menus, …). Here only the canvas page changes; the layout hides its menu,
 * header and footer while this page is open (see `ChatSidebarService.maximized`) and the page
 * covers the screen.
 */
export const AI_CHAT_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'page-sections',
	path: AI_CHAT_PAGE_PATH,
	component: AiChatPageComponent,
	title: aiChatPageTitle,
	canActivate: [aiChatPageGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.AI_CHAT_ACCESS],
			redirectTo: '/pages/dashboard'
		}
	}
};
