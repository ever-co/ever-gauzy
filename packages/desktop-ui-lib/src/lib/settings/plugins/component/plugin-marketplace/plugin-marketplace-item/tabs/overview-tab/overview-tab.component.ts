import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IPlugin, IPluginVersion, PluginStatus } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { Observable, Subject } from 'rxjs';
import { PluginMarketplaceActions } from '../../../+state/actions/plugin-marketplace.action';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginVersionQuery } from '../../../+state/queries/plugin-version.query';
import { Store } from '../../../../../../../services';

@Component({
	selector: 'gauzy-plugin-overview-tab',
	standalone: false,
	templateUrl: './overview-tab.component.html',
	styleUrls: ['./overview-tab.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewTabComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();
	readonly pluginStatus = PluginStatus;

	plugin$: Observable<IPlugin>;
	selectedVersion$: Observable<IPluginVersion>;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store,
		private readonly actions: Actions,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly versionQuery: PluginVersionQuery
	) {
		this.plugin$ = this.marketplaceQuery.plugin$;
		this.selectedVersion$ = this.versionQuery.version$;
	}

	ngOnInit(): void {
		// Plugin data is already loaded by parent component
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	get isOwner(): boolean {
		const plugin = this.marketplaceQuery.plugin;
		return !!this.store.user && this.store.user?.id === plugin?.uploadedBy?.id;
	}

	updatePluginStatus(status: PluginStatus): void {
		const pluginId = this.versionQuery.pluginId;
		if (!pluginId || !this.isOwner) return;
		this.actions.dispatch(PluginMarketplaceActions.update(pluginId, { status }));
	}

	getStatusLabel(status: PluginStatus): string {
		return `PLUGIN.FORM.STATUSES.${status}`;
	}

	getTypeLabel(type: string): string {
		return `PLUGIN.FORM.TYPES.${type}`;
	}

	formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	navigateToHistory(): void {
		const pluginId = this.versionQuery.pluginId;
		if (!pluginId) return;

		// Navigate to version history
		this.router.navigate(['settings', 'marketplace-plugins', pluginId, 'versions']);
	}
}
