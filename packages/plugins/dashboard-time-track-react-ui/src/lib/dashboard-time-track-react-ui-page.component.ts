import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactHostDirective } from '@gauzy/ui-react';
import { DashboardTimeTrackReactUiPage } from './components/DashboardTimeTrackReactUiPage';

/**
 * DashboardTimeTrackReactUiPageComponent
 *
 * Angular standalone component used as the routed entry point for the
 * "React Time Tracking" dashboard tab. Mounts the DashboardTimeTrackReactUiPage
 * React component via ReactHostDirective.
 */
@Component({
	selector: 'gz-dashboard-time-track-react-ui-page',
	standalone: true,
	imports: [CommonModule, ReactHostDirective],
	template: `<div [gaReactHost]="page"></div>`
})
export class DashboardTimeTrackReactUiPageComponent {
	readonly page = DashboardTimeTrackReactUiPage;
}
