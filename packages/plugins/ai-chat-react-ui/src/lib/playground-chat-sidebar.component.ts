import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactHostDirective } from '@gauzy/ui-react';
import { PlaygroundChatSidebar } from './components/playground/PlaygroundChatSidebar';

/**
 * PlaygroundChatSidebarComponent
 *
 * Angular standalone component that renders the chat-only playground
 * panel inside a dynamic right-side sidebar (`nb-sidebar`).
 * No settings panel — just the chat message list + input.
 *
 * Registered via `ChatSidebarService.register()` so it
 * appears as the dedicated chat panel in the layout's chat sidebar slot.
 */
@Component({
	selector: 'gz-playground-chat-sidebar',
	imports: [CommonModule, ReactHostDirective],
	template: `<div [gaReactHost]="page" style="display:flex;flex-direction:column;height:100%"></div>`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				flex: 1;
				overflow: hidden;
				height: 100%;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaygroundChatSidebarComponent {
	readonly page = PlaygroundChatSidebar;
}
