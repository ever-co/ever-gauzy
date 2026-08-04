import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatSidebarComponent } from './ai-chat-sidebar.component';

/**
 * AiChatWindowComponent
 *
 * Routed entry point of the DETACHED chat window (`/ai-chat/window`), opened
 * with `window.open` from `ChatSidebarService.detach()` so the user can drag
 * the chat onto another monitor.
 *
 * It renders {@link AiChatSidebarComponent} — the very same panel the docked
 * chat sidebar renders — so there is exactly one chat implementation. The
 * route is registered at the app root, outside the `/pages` shell, which is
 * what keeps the nav menu sidebar, header and footer off this window.
 */
@Component({
	selector: 'gz-ai-chat-window',
	imports: [AiChatSidebarComponent],
	template: `<gz-ai-chat-sidebar></gz-ai-chat-sidebar>`,
	styles: [
		`
			/* The router outlet sits in a plain <div> that has no height of its
			   own, so the window height is claimed here rather than inherited. */
			:host {
				display: flex;
				flex-direction: column;
				height: 100vh;
				width: 100%;
				min-width: 0;
				overflow: hidden;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiChatWindowComponent {
	constructor() {
		// Tell the shared panel it is running standalone: the dock-side,
		// maximize, collapse, detach and drag-to-resize controls describe a
		// docked sidebar that does not exist in this window.
		inject(ChatSidebarService).detachedView.set(true);
	}
}
