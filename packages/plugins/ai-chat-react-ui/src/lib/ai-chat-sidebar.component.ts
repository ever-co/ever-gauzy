import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
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
	template: `<div [gaReactHost]="page" style="display:flex;flex-direction:column;height:100%"></div>`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				flex: 1;
				overflow: hidden;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiChatSidebarComponent implements OnInit {
	readonly page = AiChatPanel;

	ngOnInit(): void {
		console.log('AI Chat sidebar widget initialized');
	}
}
