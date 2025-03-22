import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

import { EMPTY, firstValueFrom, Subject, tap } from 'rxjs';
import { catchError, filter, switchMap, take, takeUntil } from 'rxjs/operators';

import {
	ICDNSource,
	ID,
	IGauzySource,
	INPMSource,
	IPlugin,
	IPluginVersion,
	PluginSourceType,
	PluginStatus,
	PluginType
} from '@gauzy/contracts';

import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { PluginService } from '../../../services/plugin.service';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { DialogCreateVersionComponent } from './dialog-create-version/dialog-create-version.component';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';

@Component({
	selector: 'gauzy-plugin-marketplace-item',
	templateUrl: './plugin-marketplace-item.component.html',
	styleUrls: ['./plugin-marketplace-item.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceItemComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();

	plugin: IPlugin | null = null;
	pluginId = '';
	loading = true;

	selectedVersion: IPluginVersion = null;
	installed = false;
	needUpdate = false;
	installing = false;
	uninstalling = false;

	// Enum for template use
	readonly pluginStatus = PluginStatus;
	readonly pluginType = PluginType;
	readonly pluginSourceType = PluginSourceType;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private pluginService: PluginService,
		private pluginElectronService: PluginElectronService,
		private dialogService: NbDialogService,
		private store: Store,
		public translateService: TranslateService,
		private toastrService: ToastrNotificationService,
		private ngZone: NgZone,
		private cdr: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.route.params.pipe(takeUntil(this.destroy$)).subscribe(async (params) => {
			this.pluginId = params['id'];
			await this.loadPlugin();
		});
		this.pluginElectronService.status
			.pipe(
				distinctUntilChange(),
				tap(({ status, message }) =>
					this.ngZone.run(() => {
						this.handleStatus({ status, message });
					})
				),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	private handleStatus(notification: { status: string; message?: string }) {
		switch (notification.status) {
			case 'success':
				if (this.installing) {
					this.pluginService
						.install({ pluginId: this.plugin.id, versionId: this.selectedVersion.id })
						.subscribe(() => (this.installing = false));
				}
				if (this.uninstalling) {
					this.pluginService.uninstall(this.plugin.id).subscribe(() => (this.uninstalling = false));
				}
				this.toastrService.success(notification.message);
				break;
			case 'error':
				this.installing = false;
				this.uninstalling = this.installing;
				this.toastrService.error(notification.message);
				break;
			case 'inProgress':
				this.installing = !this.uninstalling;
				this.toastrService.info(notification.message);
				break;
			default:
				this.installing = false;
				this.uninstalling = this.installing;
				this.toastrService.warn('Unexpected Status');
				break;
		}
		this.cdr.markForCheck();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	async loadPlugin(): Promise<void> {
		this.loading = true;

		try {
			this.plugin = await firstValueFrom(
				this.pluginService.getOne(this.pluginId, {
					relations: ['versions', 'versions.source', 'uploadedBy', 'uploadedBy.user']
				})
			);
			this.selectedVersion =
				this.plugin.versions.find((v) => v.id === this.plugin.version.id) || this.plugin.version;
			await this.checkInstallation();
		} catch (error) {
			this.handleError(error);
		} finally {
			this.loading = false;
			this.cdr.markForCheck();
		}
	}

	private handleError(error: any): void {
		this.toastrService.error(error);
		this.router.navigate(['/settings/marketplace-plugins']);
	}

	async checkInstallation(): Promise<void> {
		if (!this.plugin) return;

		try {
			const plugin = await this.pluginElectronService.plugin(this.plugin.name);
			this.installed = !!plugin;

			if (this.installed && this.plugin.versions) {
				const latestVersion = this.plugin.version;
				this.needUpdate = plugin.version !== latestVersion.number;
			}
		} catch (error) {
			console.error('Installation check failed', error);
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
		if (!this.plugin || !this.isOwner) return;

		try {
			await firstValueFrom(this.pluginService.update({ ...this.plugin, status }));
			this.plugin.status = status;
			this.toastrService.success(this.translateService.instant('PLUGIN.MESSAGES.STATUS_UPDATED'));
		} catch (error) {
			this.toastrService.error(this.translateService.instant('COMMON.UPDATE_FAILED'));
		}
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
				switchMap((plugin: IPlugin) =>
					this.pluginService.update(plugin).pipe(
						tap(() => this.toastrService.success('Plugin updated successfully!')),
						catchError(() => {
							this.toastrService.error('Plugin upload failed!');
							return EMPTY;
						})
					)
				),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	navigateBack(): void {
		this.router.navigate(['/settings/marketplace-plugins']);
	}

	formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user.employee?.id === this.plugin?.uploadedBy?.id;
	}

	async onVersionChange(): Promise<void> {
		await this.checkInstallation();
	}

	updatePlugin(): void {
		this.installPlugin(true);
	}

	public async uninstallPlugin(): Promise<void> {
		this.uninstalling = true;
		this.pluginElectronService.uninstall(this.plugin as any);
		await this.loadPlugin();
	}

	installPlugin(isUpdate = false): void {
		this.installing = true;
		const source = isUpdate ? this.plugin.source : this.selectedVersion.source;

		switch (source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.pluginElectronService.downloadAndInstall({
					url: source.url,
					contextType: 'cdn'
				});
				break;
			case PluginSourceType.NPM:
				this.pluginElectronService.downloadAndInstall({
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
					contextType: 'npm'
				});
				break;
			default:
				this.installing = false;
				break;
		}
	}

	public get selectedVersionNumber(): ID {
		return this.selectedVersion.number;
	}

	public addVersion(): void {
		if (!this.plugin || !this.isOwner) return;

		this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin }
			})
			.onClose.pipe(
				filter(Boolean),
				switchMap((version: IPluginVersion) =>
					this.pluginService.addVersion(this.plugin.id, version).pipe(
						tap(() => this.toastrService.success('New version created successfully!')),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	public delete(): void {
		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						message: 'Would you like to delete this plugin?',
						title: 'Delete plugin',
						status: 'Danger'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				switchMap(() =>
					this.pluginService.delete(this.plugin.id).pipe(
						tap(() => this.toastrService.success('Plugin deleted successfully!')),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				)
			)
			.subscribe();
	}
}
