import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactHostDirective } from '@gauzy/ui-react';
import { AiChatPanel } from './components/AiChatPanel';

/**
 * AiChatSidebarComponent
 *
 * Angular standalone component that bridges the React-based AI Chat
 * panel into the Angular layout via ReactHostDirective.
 *
 * Rendered inside a dedicated `nb-sidebar` (tag: 'chat-sidebar')
 * positioned between the nav menu sidebar and the main page content.
 */
@Component({
	selector: 'gz-ai-chat-sidebar',
	imports: [CommonModule, ReactHostDirective],
	template: `<div
		[gaReactHost]="page"
		style="display:flex;flex-direction:column;height:100%;width:100%;min-width:0;max-width:100%;overflow:hidden"
	></div>`,
	styles: [
		`
			/* min-width: 0 at every flex layer — otherwise wide streamed
			   content (code blocks, tables) sets the min-content width and
			   stretches the whole panel column. */
			:host {
				display: flex;
				flex-direction: column;
				flex: 1;
				overflow: hidden;
				width: 100%;
				min-width: 0;
				max-width: 100%;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiChatSidebarComponent {
	readonly page = AiChatPanel;
}
