import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NbRouteTab, NbLayoutModule, NbRouteTabsetModule } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { PendingInstallationActions } from '../+state/pending-installation.action';

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
