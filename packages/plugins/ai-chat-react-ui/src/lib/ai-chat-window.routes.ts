import { Routes } from '@angular/router';
import { AiChatWindowComponent } from './ai-chat-window.component';

/**
 * Path segment of the detached chat window, relative to the `ai-chat` root
 * route. Together they form `/ai-chat/window` — the value of
 * `CHAT_DETACHED_WINDOW_PATH` in `@gauzy/ui-core/core`, which is what
 * `ChatSidebarService.detach()` passes to `window.open`.
 */
export const AI_CHAT_WINDOW_PATH = 'window';

/**
 * Routes of the detached chat window.
 *
 * These are wired into the app's ROOT routes (`apps/gauzy/src/app/app.routes.ts`),
 * not into the page route registry the plugin's other routes use: every
 * registry location is a child of `/pages`, which renders the `PagesComponent`
 * shell (nav menu sidebar + header + footer), and the detached window has to
 * show the chat and nothing else.
 */
export const AI_CHAT_WINDOW_ROUTES: Routes = [
	{
		path: AI_CHAT_WINDOW_PATH,
		component: AiChatWindowComponent
	},
	{
		path: '',
		redirectTo: AI_CHAT_WINDOW_PATH,
		pathMatch: 'full'
	}
];
