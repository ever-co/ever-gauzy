import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { AiChatPageComponent } from './ai-chat-page.component';
import { AiChatWindowComponent } from './ai-chat-window.component';

/**
 * Path segment of the detached chat window, relative to the `ai-chat` root
 * route. Together they form `/ai-chat/window` — the value of
 * `CHAT_DETACHED_WINDOW_PATH` in `@gauzy/ui-core/core`, which is what
 * `ChatSidebarService.detach()` passes to `window.open`.
 */
export const AI_CHAT_WINDOW_PATH = 'window';

/** `AI_CHAT_ACCESS` — the permission the playground and every chat endpoint require. */
const AI_CHAT_ACCESS_DATA = {
	permissions: {
		only: [PermissionsEnum.AI_CHAT_ACCESS],
		redirectTo: '/pages/dashboard'
	}
};

/**
 * Routes of the chat views that live outside the app shell:
 * - `/ai-chat` — the full-page chat the panel's Maximize button opens
 *   (`CHAT_FULL_PAGE_PATH` in `@gauzy/ui-core/core`);
 * - `/ai-chat/window` — the detached chat window.
 *
 * These are wired into the app's ROOT routes (`apps/gauzy/src/app/app.routes.ts`),
 * not into the page route registry the plugin's other routes use: every
 * registry location is a child of `/pages`, which renders the `PagesComponent`
 * shell (nav menu sidebar + header + footer), and these views have to show the
 * chat and nothing else.
 *
 * The root route only carries `AuthGuard`, so each view checks
 * `AI_CHAT_ACCESS` itself instead of rendering a chat whose every request 403s.
 */
export const AI_CHAT_WINDOW_ROUTES: Routes = [
	{
		path: AI_CHAT_WINDOW_PATH,
		component: AiChatWindowComponent,
		canActivate: [PermissionsGuard],
		data: AI_CHAT_ACCESS_DATA
	},
	{
		path: '',
		pathMatch: 'full',
		component: AiChatPageComponent,
		canActivate: [PermissionsGuard],
		data: AI_CHAT_ACCESS_DATA
	}
];
