import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IPlugin, IPluginVersion, PluginStatus, PluginType } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { Observable, Subject } from 'rxjs';
import { PluginMarketplaceActions } from '../../../+state/actions/plugin-marketplace.action';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginVersionQuery } from '../../../+state/queries/plugin-version.query';
import { Store } from '../../../../../../../services';
import { PluginMarketplaceUtilsService } from '../../../plugin-marketplace-utils.service';

@Component({
	selector: 'gauzy-plugin-overview-tab',
	standalone: false,
	templateUrl: './overview-tab.component.html',
	styleUrls: ['./overview-tab.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewTabComponent implements OnDestroy {
	private readonly destroy$ = new Subject<void>();
	readonly pluginStatus = PluginStatus;

	plugin$: Observable<IPlugin>;
	selectedVersion$: Observable<IPluginVersion>;

	constructor(
		private readonly router: Router,
		private readonly store: Store,
		private readonly actions: Actions,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly versionQuery: PluginVersionQuery,
		public readonly utils: PluginMarketplaceUtilsService
	) {
		this.plugin$ = this.marketplaceQuery.plugin$;
		this.selectedVersion$ = this.versionQuery.version$;
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public get isOwner(): boolean {
		const plugin = this.marketplaceQuery.plugin;
		return !!this.store.user && this.store.user?.id === plugin?.uploadedBy?.id;
	}

	public updatePluginStatus(status: PluginStatus): void {
		const pluginId = this.versionQuery.pluginId;
		if (!pluginId || !this.isOwner) return;
		this.actions.dispatch(PluginMarketplaceActions.update({ ...this.marketplaceQuery.plugin, status }));
	}

	public getStatusLabel(status: PluginStatus): string {
		return this.utils.getStatusLabel(status);
	}

	public getTypeLabel(type: PluginType): string {
		return this.utils.getTypeLabel(type);
	}

	public formatDate(date: Date | string | null): string {
		return this.utils.formatDate(date);
	}

	public async navigateToHistory(): Promise<void> {
		const pluginId = this.versionQuery.pluginId;
		if (!pluginId) return;

		// Navigate to version history
		await this.router.navigate(['plugins', 'marketplace', pluginId, 'versions']);
	}
}
