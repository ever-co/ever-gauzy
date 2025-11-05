import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { filter, Observable, Subject, takeUntil, tap } from 'rxjs';
import { PluginSubscriptionAccessFacade } from '../../../+state/plugin-subscription-access.facade';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginVersionQuery } from '../../../+state/queries/plugin-version.query';
import { PluginSettingsManagementComponent } from '../../../plugin-settings-management/plugin-settings-management.component';

@Component({
	selector: 'gauzy-plugin-settings-tab',
	standalone: false,
	templateUrl: './settings-tab.component.html',
	styleUrls: ['./settings-tab.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsTabComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();

	plugin$: Observable<IPlugin>;
	canConfigure$: Observable<boolean>;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly actions: Actions,
		private readonly dialogService: NbDialogService,
		private readonly marketplaceQuery: PluginMarketplaceQuery,
		private readonly versionQuery: PluginVersionQuery,
		private readonly accessFacade: PluginSubscriptionAccessFacade
	) {
		this.plugin$ = this.marketplaceQuery.plugin$;
	}

	ngOnInit(): void {
		// Set up permission check
		this.plugin$
			.pipe(
				filter(Boolean),
				tap((plugin) => {
					// Check if user can configure settings (using hasAccess for now)
					this.canConfigure$ = this.accessFacade.hasAccess$(plugin.id);
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	openSettingsDialog(): void {
		const plugin = this.marketplaceQuery.plugin;
		if (!plugin) return;

		this.dialogService
			.open(PluginSettingsManagementComponent, {
				context: {
					plugin: plugin
				},
				backdropClass: 'backdrop-blur',
				closeOnEsc: false
			})
			.onClose.pipe(
				filter(Boolean),
				tap(() => {
					// Reload plugin data after settings update
					// You can dispatch an action here if needed
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}
}
