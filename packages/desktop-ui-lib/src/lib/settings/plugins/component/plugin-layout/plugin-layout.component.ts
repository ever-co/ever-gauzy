import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
	selector: 'ngx-plugin-layout',
	templateUrl: './plugin-layout.component.html',
	styleUrls: ['./plugin-layout.component.scss'],
	standalone: false
})
export class PluginLayoutComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	private destroy$ = new Subject<void>();

	constructor(
		private readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private router: Router,
		private readonly pluginElectronService: PluginElectronService
	) {}

	ngOnInit() {
		// Initialize tabs immediately
		this.updateTabs();

		// Use takeUntil for cleaner subscription management
		this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.updateTabs());
	}

	ngOnDestroy() {
		// Emit completion and clean up all subscriptions
		this.destroy$.next();
		this.destroy$.complete();
	}

	private get baseRoute(): string {
		return this.router.createUrlTree(['./'], { relativeTo: this.route }).toString();
	}

	private updateTabs() {
		this.tabs = [
			{
				title: this.translateService.instant('PLUGIN.LAYOUT.DISCOVER'),
				route: `${this.baseRoute}/marketplace`,
				icon: 'search-outline',
				responsive: true,
				activeLinkOptions: {
					exact: false
				}
			},
			this.pluginElectronService.isDesktop && {
				title: this.translateService.instant('PLUGIN.LAYOUT.INSTALLED'),
				route: `${this.baseRoute}/installed`,
				icon: 'checkmark-circle-2-outline',
				activeLinkOptions: {
					exact: false
				}
			}
		];
	}
}
