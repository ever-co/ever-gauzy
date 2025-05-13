import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subject, tap } from 'rxjs';
import { catchError, concatMap, filter, take, takeUntil } from 'rxjs/operators';
import {
	ICDNSource,
	IGauzySource,
	INPMSource,
	IPlugin,
	IPluginVersion,
	PluginSourceType,
	PluginStatus,
	PluginType
} from '@gauzy/contracts';

import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Actions } from '@ngneat/effects-ng';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { PluginVersionQuery } from '../+state/queries/plugin-version.query';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { IPlugin as IPluginInstalled } from '../../../services/plugin-loader.service';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { DialogCreateVersionComponent } from './dialog-create-version/dialog-create-version.component';

@Component({
	selector: 'gauzy-plugin-marketplace-item',
	templateUrl: './plugin-marketplace-item.component.html',
	styleUrls: ['./plugin-marketplace-item.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceItemComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();
	installed$ = new BehaviorSubject<boolean>(false);
	needUpdate$ = new BehaviorSubject<boolean>(false);

	// Enum for template use
	readonly pluginStatus = PluginStatus;
	readonly pluginType = PluginType;
	readonly pluginSourceType = PluginSourceType;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly pluginElectronService: PluginElectronService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService,
		private readonly action: Actions,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly installationQuery: PluginInstallationQuery,
		public readonly versionQuery: PluginVersionQuery
	) {}

	ngOnInit(): void {
		this.plugin$
			.pipe(
				filter(Boolean),
				distinctUntilChange(),
				concatMap((plugin) => {
					this.action.dispatch(PluginVersionActions.selectVersion(plugin.version));
					return this.checkInstallation(plugin);
				}),
				catchError((error) => this.handleError(error)),
				takeUntil(this.destroy$)
			)
			.subscribe();
		this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
			this.action.dispatch(PluginVersionActions.setCurrentPluginId(params['id']));
			this.loadPlugin();
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public loadPlugin(): void {
		this.action.dispatch(
			PluginMarketplaceActions.getOne(this.pluginId, {
				relations: ['versions', 'versions.source', 'uploadedBy', 'uploadedBy.user'],
				order: { versions: { releaseDate: 'DESC' } }
			})
		);
	}

	private async handleError(error: any): Promise<void> {
		this.toastrService.error(error);
		await this.router.navigate(['/settings/marketplace-plugins']);
	}

	async checkInstallation(plugin: IPlugin): Promise<void> {
		if (!plugin) return;

		try {
			const installed = await this.checkPlugin(plugin);
			this.installed$.next(!!installed);

			if (installed && plugin.versions) {
				this.needUpdate$.next(installed.version !== plugin.version.number);
			}
		} catch (error) {
			this.installed$.next(false);
		}
	}

	async checkPlugin(plugin: IPlugin): Promise<IPluginInstalled> {
		if (!plugin) return;
		try {
			return this.pluginElectronService.checkInstallation(plugin.id);
		} catch (error) {
			return null;
		}
	}

	// Utility methods with strong typing
	getSourceTypeLabel(type: PluginSourceType): string {
		const labels: Record<PluginSourceType, string> = {
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
		const statusMap: Record<PluginStatus, string> = {
			[PluginStatus.ACTIVE]: 'success',
			[PluginStatus.INACTIVE]: 'warning',
			[PluginStatus.DEPRECATED]: 'info',
			[PluginStatus.ARCHIVED]: 'danger'
		};
		return statusMap[status] || 'basic';
	}

	getPluginTypeBadgeStatus(type: PluginType): string {
		const typeMap: Record<PluginType, string> = {
			[PluginType.DESKTOP]: 'primary',
			[PluginType.WEB]: 'info',
			[PluginType.MOBILE]: 'success'
		};
		return typeMap[type] || 'basic';
	}

	getPluginSourceTypeBadgeStatus(type: PluginSourceType): string {
		const typeMap: Record<PluginSourceType, string> = {
			[PluginSourceType.GAUZY]: 'primary',
			[PluginSourceType.CDN]: 'info',
			[PluginSourceType.NPM]: 'danger'
		};
		return typeMap[type] || 'basic';
	}

	getSourceDetails(plugin: IPlugin): string {
		switch (plugin.source.type) {
			case PluginSourceType.CDN:
				return (plugin.source as ICDNSource).url;
			case PluginSourceType.NPM:
				const npmSource = plugin.source as INPMSource;
				return `${npmSource.scope ? npmSource.scope + '/' : ''}${npmSource.name}@${plugin.version.number}`;
			case PluginSourceType.GAUZY:
				return (
					(plugin.source as IGauzySource).url || this.translateService.instant('PLUGIN.DETAILS.UPLOADED_FILE')
				);
			default:
				return this.translateService.instant('PLUGIN.DETAILS.UNKNOWN_SOURCE');
		}
	}

	async updatePluginStatus(status: PluginStatus): Promise<void> {
		if (!this.pluginId || !this.isOwner) return;
		this.action.dispatch(PluginMarketplaceActions.update(this.pluginId, { status }));
	}

	navigateToEdit(): void {
		if (!this.plugin) return;

		this.dialogService
			.open(PluginMarketplaceUploadComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin }
			})
			.onClose.pipe(
				filter(Boolean),
				tap((plugin: IPlugin) => {
					this.action.dispatch(
						PluginInstallationActions.toggle({ isChecked: this.isInstalled, plugin: this.plugin })
					);
					this.action.dispatch(PluginMarketplaceActions.update(this.pluginId, plugin));
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	navigateBack(): void {
		this.router.navigate(['/settings/marketplace-plugins']);
	}

	navigateToHistory(): void {
		this.router.navigate(['settings', 'marketplace-plugins', this.pluginId, 'versions']);
	}

	formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user.employee?.id === this.plugin?.uploadedBy?.id;
	}

	updatePlugin(): void {
		this.installPlugin(true);
	}

	public async uninstallPlugin(): Promise<void> {
		this.dialogService
			.open(AlertComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					data: {
						title: 'PLUGIN.DIALOG.UNINSTALL.TITLE',
						message: 'PLUGIN.DIALOG.UNINSTALL.DESCRIPTION',
						confirmText: 'PLUGIN.DIALOG.UNINSTALL.CONFIRM',
						status: 'basic'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				concatMap(() => this.checkPlugin(this.plugin)),
				filter(Boolean),
				tap((plugin) => {
					this.action.dispatch(PluginInstallationActions.toggle({ isChecked: false, plugin: this.plugin }));
					this.action.dispatch(PluginInstallationActions.uninstall(plugin));
				})
			)
			.subscribe();
	}

	installPlugin(isUpdate = false): void {
		const source = isUpdate ? this.plugin.source : this.selectedVersion.source;
		const versionId = isUpdate ? this.plugin.version.id : this.selectedVersion.id;
		this.action.dispatch(PluginInstallationActions.toggle({ isChecked: true, plugin: this.plugin }));
		switch (source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.action.dispatch(
					PluginInstallationActions.install({
						url: source.url,
						contextType: 'cdn',
						marketplaceId: this.pluginId,
						versionId
					})
				);
				break;
			case PluginSourceType.NPM:
				this.action.dispatch(
					PluginInstallationActions.install({
						...{
							pkg: {
								name: source.name,
								version: isUpdate ? this.plugin.version.number : this.selectedVersionNumber
							},
							registry: {
								privateURL: source.registry,
								authToken: source.authToken
							}
						},
						contextType: 'npm',
						marketplaceId: this.pluginId,
						versionId
					})
				);
				break;
			default:
				break;
		}
	}

	public get selectedVersionNumber(): string {
		return this.selectedVersion.number;
	}

	public addVersion(): void {
		if (!this.plugin || !this.isOwner || !this.pluginId) return;

		this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin }
			})
			.onClose.pipe(
				filter(Boolean),
				tap((version: IPluginVersion) => {
					this.action.dispatch(
						PluginInstallationActions.toggle({ isChecked: this.isInstalled, plugin: this.plugin })
					);
					this.action.dispatch(PluginVersionActions.add(this.pluginId, version));
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	public delete(): void {
		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						message: 'PLUGIN.DIALOG.DELETE.DESCRIPTION',
						title: 'PLUGIN.DIALOG.DELETE.TITLE',
						confirmText: 'PLUGIN.DIALOG.DELETE.CONFIRM',
						status: 'Danger'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => {
					this.action.dispatch(
						PluginInstallationActions.toggle({ isChecked: this.isInstalled, plugin: this.plugin })
					);
					this.action.dispatch(PluginMarketplaceActions.delete(this.pluginId));
				})
			)
			.subscribe();
	}

	public get plugin$(): Observable<IPlugin> {
		return this.marketplaceQuery.plugin$;
	}

	private get plugin(): IPlugin {
		return this.marketplaceQuery.plugin;
	}

	public get pluginId(): string {
		return this.versionQuery.pluginId;
	}

	private get isInstalled(): boolean {
		return this.installed$.value;
	}

	private get selectedVersion(): IPluginVersion {
		return this.versionQuery.version;
	}
}
