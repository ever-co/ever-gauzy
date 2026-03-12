import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NbLayoutModule, NbRouteTab, NbRouteTabsetModule } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PendingInstallationActions } from '../+state/pending-installation.action';
import { PluginActions } from '../+state/plugin.action';
import { PluginElectronService } from '../../services/plugin-electron.service';

@Component({
    selector: 'ngx-plugin-layout',
    templateUrl: './plugin-layout.component.html',
    styleUrls: ['./plugin-layout.component.scss'],
    imports: [NbLayoutModule, RouterLink, NbRouteTabsetModule, TranslatePipe]
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

		// Check pending installations
		this.checkPendingInstallations();

		// Sync local plugin activation with backend access control
		this.actions.dispatch(PluginActions.syncAccess());
	}

	ngOnDestroy() {
		// Emit completion and clean up all subscriptions
		this.destroy$.next();
		this.destroy$.complete();
	}

	private checkPendingInstallations() {
		this.actions.dispatch(PendingInstallationActions.checkAndShowDialog());
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
