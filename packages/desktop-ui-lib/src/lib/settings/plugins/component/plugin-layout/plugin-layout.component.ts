import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
	selector: 'ngx-plugin-layout',
	templateUrl: './plugin-layout.component.html',
	styleUrls: ['./plugin-layout.component.scss']
})
export class PluginLayoutComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	private destroy$ = new Subject<void>();

	constructor(private readonly translateService: TranslateService) {}

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

	private updateTabs() {
		this.tabs = [
			{
				title: this.translateService.instant('PLUGIN.LAYOUT.DISCOVER'),
				route: '/settings/marketplace-plugins',
				icon: 'search-outline',
				responsive: true,
				activeLinkOptions: {
					exact: false
				}
			},
			{
				title: this.translateService.instant('PLUGIN.LAYOUT.INSTALLED'),
				route: '/settings/plugins',
				icon: 'checkmark-circle-2-outline',
				activeLinkOptions: {
					exact: false
				}
			}
		];
	}
}
