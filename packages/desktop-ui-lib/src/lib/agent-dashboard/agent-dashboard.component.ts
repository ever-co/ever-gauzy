import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { NbSidebarService, NbMenuItem } from '@nebular/theme';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GAUZY_ENV } from '../constants';
import { Subject, takeUntil } from 'rxjs';


@Component({
	selector: 'ngx-agent-dashboard',
	templateUrl: './agent-dashboard.component.html',
	styleUrls: ['./agent-dashboard.component.scss'],
	standalone: false
})
export class AgentDashboardComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();

	menu: NbMenuItem[] = [
		{
			title: 'Logs',
			link: '/server-dashboard/logs', // Assuming this will be the route for logs
			icon: 'file-text-outline',
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
		private sidebarService: NbSidebarService,
		private domSanitizer: DomSanitizer,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
	) {
		this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl('./assets/images/logos/logo_Gauzy.svg');
	}
	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	ngOnInit(): void {
		// Set initial logo based on sidebar state
		this.sidebarService.getSidebarState('menu')
			.pipe(takeUntil(this.destroy$))
			.subscribe(initialState => {
				if (initialState === 'compacted' || initialState === 'collapsed') {
					this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl(this._environment.PLATFORM_LOGO);
				} else {
					this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl('./assets/images/logos/logo_Gauzy.svg');
				}
			});

		this.sidebarService.onCollapse()
			.pipe(takeUntil(this.destroy$))
			.subscribe(() => {
				this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl(this._environment.PLATFORM_LOGO);
			});

		this.sidebarService.onExpand()
			.pipe(takeUntil(this.destroy$))
			.subscribe(() => {
				this.gauzyIcon = this.domSanitizer.bypassSecurityTrustResourceUrl('./assets/images/logos/logo_Gauzy.svg');
			});
	}
}
