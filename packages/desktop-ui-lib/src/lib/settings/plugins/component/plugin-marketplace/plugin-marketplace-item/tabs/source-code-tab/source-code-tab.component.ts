import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { IPlugin, IPluginSource, PluginSourceType } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginSourceQuery } from '../../../+state/queries/plugin-source.query';

@Component({
	selector: 'gauzy-plugin-source-code-tab',
	standalone: false,
	templateUrl: './source-code-tab.component.html',
	styleUrls: ['./source-code-tab.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SourceCodeTabComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();
	readonly pluginSourceType = PluginSourceType;

	plugin$: Observable<IPlugin>;
	selectedSource$: Observable<IPluginSource>;

	constructor(
		private readonly translateService: TranslateService,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly sourceQuery: PluginSourceQuery
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
		const labels: Record<PluginSourceType, string> = {
			[PluginSourceType.CDN]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.CDN'),
			[PluginSourceType.NPM]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.NPM'),
			[PluginSourceType.GAUZY]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.GAUZY')
		};
		return labels[type] || type;
	}

	getPluginSourceTypeBadgeStatus(type: PluginSourceType): string {
		const typeMap: Record<PluginSourceType, string> = {
			[PluginSourceType.GAUZY]: 'primary',
			[PluginSourceType.CDN]: 'info',
			[PluginSourceType.NPM]: 'danger'
		};
		return typeMap[type] || 'basic';
	}
}
