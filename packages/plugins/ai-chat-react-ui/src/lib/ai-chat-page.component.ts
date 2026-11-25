import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, inject } from '@angular/core';
import { ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatSidebarComponent } from './ai-chat-sidebar.component';

/**
 * AiChatPageComponent
 *
 * Routed entry point of the FULL-PAGE chat (`/pages/ai-chat`) — what the
 * panel's Maximize button opens. It is a page inside the `/pages` shell (so
 * opening and leaving it never rebuilds the shell — see `AI_CHAT_PAGE_ROUTE`);
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
 * Maximize button shows Restore here, and so leaving it by ANY route — Restore,
 * Close, browser Back, or the assistant opening a page — ends maximized mode.
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
		chatSidebar.setFullPageOpen(true);

		// The layout scrolls the WINDOW (Nebular window mode), and the shell under this page is
		// still taller than the screen — so the browser drew a page scrollbar beside the chat that
		// scrolled nothing visible. The conversation has its own scroller; the page must not scroll.
		const { documentElement: html, body } = inject(DOCUMENT);
		const previous = { html: html.style.overflow, body: body.style.overflow };
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';

		inject(DestroyRef).onDestroy(() => {
			html.style.overflow = previous.html;
			body.style.overflow = previous.body;
			chatSidebar.setFullPageOpen(false);
		});
	}
}
