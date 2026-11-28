import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatSidebarComponent } from './ai-chat-sidebar.component';

/**
 * AiChatPageComponent
 *
 * Routed entry point of the FULL-PAGE chat (`/pages/ai-chat`) — a direct link
 * to the chat on its own (a bookmark, `/ai-chat`). The panel's Maximize does not
 * come here: it expands the docked chat in place, keeping the page underneath
 * alive. This is a page inside the `/pages` shell (see `AI_CHAT_PAGE_ROUTE`);
 * while it is open the layout hides its menu, header and footer, and this page
 * covers the screen.
 *
 * It renders {@link AiChatSidebarComponent}, the same panel the docked sidebar
 * renders, and that panel takes its conversation from the shared chat session
 * (see `ai-chat-session.ts`): the conversation, a reply still streaming, the
 * draft and the staged attachments all carry over between the docked panel and
 * this page, in both directions.
 *
 * The page tells `ChatSidebarService` while it is on screen, so the panel's
 * Maximize button shows Restore here (it leaves the page), and so leaving it by
 * ANY route — Restore, Close, browser Back, or the assistant opening a page —
 * ends maximized mode.
 */
@Component({
	selector: 'gz-ai-chat-page',
	imports: [AiChatSidebarComponent],
	template: `<gz-ai-chat-sidebar></gz-ai-chat-sidebar>`,
	styles: [
		`
			/* Covers the whole screen: the shell's menu, header and footer are hidden
			   while this page is open, and the content column's padding must not frame
			   the chat. Below the overlay container (dialogs, toasts, tooltips at 1040+). */
			:host {
				position: fixed;
				inset: 0;
				z-index: 1030;
				/* The pages shell gives every routed page \`display: block\` and a 1s fade-in
				   (\`router-outlet + *\` in pages.component.scss): the chat needs its flex column, and
				   opening it must be instant. */
				display: flex !important;
				animation: none !important;
				flex-direction: column;
				min-width: 0;
				overflow: hidden;
				background: var(--layout-background-color, var(--background-basic-color-1));
				color: var(--text-basic-color);
				/* The docked chat gets --gz-chat-surface from its nb-sidebar wrapper; this page
				   has no wrapper, so publish the page background it renders on (same as the
				   detached window) — the panel's overlays need an opaque surface. */
				--gz-chat-surface: var(--background-basic-color-1, Canvas);
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiChatPageComponent {
	constructor() {
		const chatSidebar = inject(ChatSidebarService);
		// Open = maximized: the layout hides its chrome, skips the docked chat and locks the
		// window's scroll while this page is on screen.
		chatSidebar.setFullPageOpen(true);

		// The route sets the tab title to "AI Assistant" after this page is created, and a page
		// without a title of its own would leave it there — so the title the user came from goes
		// back when this page is left.
		const title = inject(Title);
		const previousTitle = title.getTitle();

		inject(DestroyRef).onDestroy(() => {
			chatSidebar.setFullPageOpen(false);
			title.setTitle(previousTitle);
		});
	}
}
