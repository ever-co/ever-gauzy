import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbRouteTab } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PendingInstallationActions } from '../+state/pending-installation.action';
import { PluginElectronService } from '../../services/plugin-electron.service';

@Component({
	selector: 'ngx-plugin-layout',
	templateUrl: './plugin-layout.component.html',
	styleUrls: ['./plugin-layout.component.scss'],
	standalone: false
})
export class PluginLayoutComponent implements OnInit, OnDestroy {
	private readonly actions = inject(Actions);

	public tabs: NbRouteTab[] = [];
	private destroy$ = new Subject<void>();

	constructor(
		private readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly pluginElectronService: PluginElectronService
	) {}

	ngOnInit() {
		// Initialize tabs immediately
		this.updateTabs();

		// Use takeUntil for cleaner subscription management
		this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.updateTabs());

		// Check and show pending installation dialog if needed
		// This is triggered when the PluginsModule is loaded
		this.checkPendingInstallations();
	}

	ngOnDestroy() {
		// Emit completion and clean up all subscriptions
		this.destroy$.next();
		this.destroy$.complete();
	}

	/**
	 * Dispatches action to check and show pending installation dialog if there are pending plugins.
	 * The guard has already performed the check and updated the store.
	 * This just triggers the dialog display if needed.
	 */
	private checkPendingInstallations(): void {
		if (this.pluginElectronService.isDesktop) {
			this.actions.dispatch(PendingInstallationActions.checkAndShowDialog());
		}
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
			}
		];

		if (this.pluginElectronService.isDesktop) {
			this.tabs.push({
				title: this.translateService.instant('PLUGIN.LAYOUT.INSTALLED'),
				route: `${this.baseRoute}/installed`,
				icon: 'checkmark-circle-2-outline',
				activeLinkOptions: {
					exact: false
				}
			});
		}
	}
}
