import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbRouteTab, NbRouteTabsetModule } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PendingInstallationActions } from '../+state/pending-installation.action';
import { PluginActions } from '../+state/plugin.action';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { PLUGIN_SHOW_BUILTIN } from './plugin-show-builtin.token';

@Component({
	selector: 'ngx-plugin-layout',
	templateUrl: './plugin-layout.component.html',
	styleUrls: ['./plugin-layout.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbRouteTabsetModule]
})
export class PluginLayoutComponent implements OnInit, OnDestroy {
	private readonly actions = inject(Actions);
	private readonly showBuiltin = inject(PLUGIN_SHOW_BUILTIN);
	private readonly translateService = inject(TranslateService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly pluginElectronService = inject(PluginElectronService);

	public tabs: NbRouteTab[] = [];
	private destroy$ = new Subject<void>();

	ngOnInit() {
		this.updateTabs();
		this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.updateTabs());
		this.checkPendingInstallations();
		this.actions.dispatch(PluginActions.syncAccess());
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private checkPendingInstallations() {
		this.actions.dispatch(PendingInstallationActions.checkAndShowDialog());
	}

	private get baseRoute(): string {
		return this.router.createUrlTree(['./'], { relativeTo: this.route }).toString();
	}

	public get isWebview(): boolean {
		return !this.pluginElectronService.isDesktop && this.showBuiltin;
	}

	private updateTabs() {
		this.tabs = [];

		// Built-in tab: only shown in web app (when PLUGIN_SHOW_BUILTIN token is true)
		if (this.showBuiltin) {
			this.tabs.push({
				title: this.translateService.instant('PLUGIN.LAYOUT.BUILTIN'),
				route: `${this.baseRoute}/built-in`,
				icon: 'cube-outline',
				responsive: true,
				activeLinkOptions: { exact: false }
			});
		}

		// Marketplace tab: always visible
		this.tabs.push({
			title: this.translateService.instant('PLUGIN.LAYOUT.MARKETPLACE'),
			route: `${this.baseRoute}/marketplace`,
			icon: 'shopping-bag-outline',
			responsive: true,
			activeLinkOptions: { exact: false }
		});

		// Installed tab: desktop only
		if (this.pluginElectronService.isDesktop) {
			this.tabs.push({
				title: this.translateService.instant('PLUGIN.LAYOUT.INSTALLED'),
				route: `${this.baseRoute}/installed`,
				icon: 'checkmark-circle-2-outline',
				responsive: true,
				activeLinkOptions: { exact: false }
			});
		}
	}
}
