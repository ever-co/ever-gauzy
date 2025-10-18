import { Component, Inject } from '@angular/core';
import { NbMenuItem, NbSidebarState } from '@nebular/theme';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GAUZY_ENV } from '../constants';


@Component({
	selector: 'ngx-agent-dashboard',
	templateUrl: './agent-dashboard.component.html',
	styleUrls: ['./agent-dashboard.component.scss'],
	standalone: false
})
export class AgentDashboardComponent {

	menu: NbMenuItem[] = [
		{
			title: 'Logs',
			link: '/server-dashboard/logs', // Assuming this will be the route for logs
			icon: 'file-text-outline',
			home: true,
			selected: true,
		},
		{
			title: 'Sync API Activity',
			link: '/server-dashboard/sync-activity', // Assuming this will be the route for sync activity
			icon: 'sync-outline',
		},
	];
	gauzyIcon: SafeResourceUrl;
	styles = {
		btnStart: 'button-small',
		icon: 'margin-icon-small'
	};

	constructor(
		private domSanitizer: DomSanitizer,
		@Inject(GAUZY_ENV)
		private readonly _environment: Record<string, any>,
	) {
		this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl(this._environment.PLATFORM_LOGO);
	}

	onSidebarStateChange(newState: NbSidebarState) {
		if (newState === 'compacted') {
			this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl(this._environment.GAUZY_DESKTOP_LOGO_512X512);
		} else {
			this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl(this._environment.PLATFORM_LOGO);
		}
	}
}
