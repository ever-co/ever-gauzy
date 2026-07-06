import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactHostDirective } from '@gauzy/ui-react';
import { Playground } from './components/playground/Playground';

/**
 * PlaygroundPageComponent
 *
 * Angular standalone component used as the routed entry point for
 * the `/pages/playground` route. Mounts the React `Playground`
 * component via ReactHostDirective, filling the full page height.
 */
@Component({
	selector: 'gz-ai-playground-page',
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
export class PlaygroundPageComponent {
	readonly page = Playground;
}
