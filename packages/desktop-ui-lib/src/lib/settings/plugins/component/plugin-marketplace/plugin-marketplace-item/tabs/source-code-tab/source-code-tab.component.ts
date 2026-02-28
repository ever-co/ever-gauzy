import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { IPlugin, IPluginSource, PluginSourceType } from '@gauzy/contracts';
import { Observable, Subject } from 'rxjs';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginSourceQuery } from '../../../+state/queries/plugin-source.query';
import { PluginMarketplaceUtilsService } from '../../../plugin-marketplace-utils.service';
import { NbIconModule, NbBadgeModule, NbTooltipModule } from '@nebular/theme';
import { AsyncPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'gauzy-plugin-source-code-tab',
    templateUrl: './source-code-tab.component.html',
    styleUrls: ['./source-code-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbIconModule, NbBadgeModule, NbTooltipModule, AsyncPipe, TranslatePipe]
})
export class SourceCodeTabComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();
	readonly pluginSourceType = PluginSourceType;

	plugin$: Observable<IPlugin>;
	selectedSource$: Observable<IPluginSource>;

	constructor(
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly sourceQuery: PluginSourceQuery,
		private readonly utils: PluginMarketplaceUtilsService
	) {
		this.plugin$ = this.marketplaceQuery.plugin$;
		this.selectedSource$ = this.sourceQuery.source$;
	}

	ngOnInit(): void {
		// Plugin data is already loaded by parent component
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	getSourceTypeLabel(type: PluginSourceType): string {
		return this.utils.getSourceTypeLabel(type);
	}

	getPluginSourceTypeBadgeStatus(type: PluginSourceType): string {
		return this.utils.getPluginSourceTypeBadgeStatus(type);
	}
}
