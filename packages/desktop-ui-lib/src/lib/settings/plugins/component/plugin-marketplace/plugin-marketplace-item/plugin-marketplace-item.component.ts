import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import {
	ICDNSource,
	IGauzySource,
	INPMSource,
	IPlugin,
	PluginSourceType,
	PluginStatus,
	PluginType
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { takeUntil } from 'rxjs/operators';
import { PluginService } from '../../../services/plugin.service';
import { Store } from '../../../../../services';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';

@Component({
	selector: 'lib-plugin-marketplace-item',
	templateUrl: './plugin-marketplace-item.component.html',
	styleUrl: './plugin-marketplace-item.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceItemComponent implements OnInit, OnDestroy {
	plugin: IPlugin;
	pluginId: string;
	loading = true;
	pluginStatus = PluginStatus;
	pluginType = PluginType;
	pluginSourceType = PluginSourceType;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly pluginsService: PluginService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: NbToastrService,
		private readonly store: Store,
		readonly translateService: TranslateService
	) {}

	ngOnInit() {
		this.route.params.pipe(takeUntil(this._ngDestroy$)).subscribe((params) => {
			this.pluginId = params.id;
			this.loadPlugin();
		});
	}

	async loadPlugin() {
		this.loading = true;

		try {
			// const { tenantId, organizationId } = this.store.selectedOrganization;
			//
			// this.plugin = await this.pluginsService.getById(this.pluginId, { tenantId, organizationId });
		} catch (error) {
			this.toastrService.danger(error, this.translateService.instant('TOASTR.TITLE.ERROR'));
			this.router.navigate(['/settings/marketplace-plugins']);
		} finally {
			this.loading = false;
		}
	}

	getSourceTypeLabel(type: PluginSourceType): string {
		const labels = {
			[PluginSourceType.CDN]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.CDN'),
			[PluginSourceType.NPM]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.NPM'),
			[PluginSourceType.GAUZY]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.GAUZY')
		};
		return labels[type] || type;
	}

	getStatusLabel(status: PluginStatus): string {
		return this.translateService.instant(`PLUGIN.FORM.STATUSES.${status}`);
	}

	getTypeLabel(type: PluginType): string {
		return this.translateService.instant(`PLUGIN.FORM.TYPES.${type}`);
	}

	getStatusBadgeStatus(status: PluginStatus): string {
		const statusMap = {
			[PluginStatus.ACTIVE]: 'success',
			[PluginStatus.INACTIVE]: 'warning',
			[PluginStatus.DEPRECATED]: 'info',
			[PluginStatus.ARCHIVED]: 'danger'
		};
		return statusMap[status] || 'basic';
	}

	getPluginTypeBadgeStatus(type: PluginType): string {
		const typeMap = {
			[PluginType.DESKTOP]: 'primary',
			[PluginType.WEB]: 'info',
			[PluginType.MOBILE]: 'success'
		};
		return typeMap[type] || 'basic';
	}

	getSourceDetails(plugin: IPlugin): string {
		switch (plugin.source.type) {
			case PluginSourceType.CDN:
				const cdnSource = plugin.source as ICDNSource;
				return cdnSource.url;
			case PluginSourceType.NPM:
				const npmSource = plugin.source as INPMSource;
				return `${npmSource.scope ? npmSource.scope + '/' : ''}${npmSource.name}@${npmSource.version}`;
			case PluginSourceType.GAUZY:
				const gauzySource = plugin.source as IGauzySource;
				return gauzySource.url || this.translateService.instant('PLUGIN.DETAILS.UPLOADED_FILE');
			default:
				return this.translateService.instant('PLUGIN.DETAILS.UNKNOWN_SOURCE');
		}
	}

	async updatePluginStatus(status: PluginStatus) {
		try {
			// const { tenantId, organizationId } = this.store.selectedOrganization;
			//
			// await this.pluginsService.update(this.pluginId, {
			// 	status,
			// 	tenantId,
			// 	organizationId
			// });

			this.plugin.status = status;

			this.toastrService.success(
				this.translateService.instant('PLUGIN.MESSAGES.STATUS_UPDATED'),
				this.translateService.instant('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(error, this.translateService.instant('TOASTR.TITLE.ERROR'));
		}
	}

	navigateToEdit() {
		this.dialogService.open(PluginMarketplaceUploadComponent, {
			backdropClass: 'backdrop-blur',
			context: {
				plugin: this.plugin
			}
		});
	}

	navigateBack() {
		this.router.navigate(['/settings/marketplace-plugins']);
	}

	formatDate(date: Date): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
