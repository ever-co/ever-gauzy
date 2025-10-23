import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { NbMenuItem, NbSidebarState } from '@nebular/theme';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GAUZY_ENV } from '../constants';
import { IpcService } from './services/ipc.service';
import { TasksService } from './services/tasks-service';


@Component({
	selector: 'ngx-agent-dashboard',
	templateUrl: './agent-dashboard.component.html',
	styleUrls: ['./agent-dashboard.component.scss'],
	standalone: false
})
export class AgentDashboardComponent implements OnInit, OnDestroy {
	menu: NbMenuItem[] = [
		{
			title: 'Tasks',
			link: '/server-dashboard/tasks',
			icon: 'checkmark-square-2-outline',
			pathMatch: 'prefix'
		},
		{
			title: 'Logs',
			link: '/server-dashboard/logs', // Assuming this will be the route for logs
			icon: 'file-text-outline'
		},
		{
			title: 'Sync API Activity',
			link: '/server-dashboard/sync-activity', // Assuming this will be the route for sync activity
			icon: 'cloud-upload-outline'
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
		private _ipcService: IpcService,
		private _tasksService: TasksService
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

	ngOnInit(): void {
		this._ipcService.ipcListen();
		this._tasksService.loadTaskStatus();
	}

	ngOnDestroy(): void {
		this._ipcService.ipcRemoveListener();
	}
}
