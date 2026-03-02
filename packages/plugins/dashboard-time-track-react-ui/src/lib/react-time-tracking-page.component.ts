import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactHostDirective } from '@gauzy/ui-react';
import { ReactTimeTrackingPage } from './components/ReactTimeTrackingPage';

/**
 * ReactTimeTrackingPageComponent
 *
 * Angular standalone component used as the routed entry point for the
 * "React Time Tracking" dashboard tab. Mounts the ReactTimeTrackingPage
 * React component via ReactHostDirective.
 */
@Component({
	selector: 'gz-react-time-tracking-page',
	standalone: true,
	imports: [CommonModule, ReactHostDirective],
	template: `<div [gaReactHost]="page"></div>`
})
export class ReactTimeTrackingPageComponent {
	readonly page = ReactTimeTrackingPage;
}
