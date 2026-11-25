import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatSidebarComponent } from './ai-chat-sidebar.component';

/**
 * AiChatPageComponent
 *
 * Routed entry point of the FULL-PAGE chat (`/ai-chat`) — what the panel's
 * Maximize button opens. Like the detached window it is registered at the app
 * root, outside the `/pages` shell, so the chat gets the whole screen with no
 * nav menu sidebar, header or footer around it.
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
			/* The router outlet sits in a plain <div> that has no height of its
			   own, so the page height is claimed here rather than inherited. */
			:host {
				display: flex;
				flex-direction: column;
				height: 100vh;
				width: 100%;
				min-width: 0;
				overflow: hidden;
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
		inject(DestroyRef).onDestroy(() => chatSidebar.setFullPageOpen(false));
	}
}
