import { ChangeDetectionStrategy, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

import { BehaviorSubject, EMPTY, firstValueFrom, Subject, tap } from 'rxjs';
import { catchError, concatMap, filter, finalize, switchMap, take, takeUntil } from 'rxjs/operators';

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
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { PluginService } from '../../../services/plugin.service';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { DialogCreateVersionComponent } from './dialog-create-version/dialog-create-version.component';

@Component({
	selector: 'gauzy-plugin-marketplace-item',
	templateUrl: './plugin-marketplace-item.component.html',
	styleUrls: ['./plugin-marketplace-item.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceItemComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();

	plugin$ = new BehaviorSubject<IPlugin>(null);
	pluginId = '';
	loading$ = new BehaviorSubject<boolean>(false);
	selectedVersion: IPluginVersion = null;
	installed$ = new BehaviorSubject<boolean>(false);
	needUpdate$ = new BehaviorSubject<boolean>(false);
	installing$ = new BehaviorSubject<boolean>(false);
	uninstalling$ = new BehaviorSubject<boolean>(false);
	editing$ = new BehaviorSubject<boolean>(false);
	deleting$ = new BehaviorSubject<boolean>(false);
	adding$ = new BehaviorSubject<boolean>(false);
	reload$ = new Subject<void>();

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
		private ngZone: NgZone
	) {}

	ngOnInit(): void {
		this.plugin$
			.pipe(
				filter(Boolean),
				distinctUntilChange(),
				concatMap((plugin) => {
					this.selectedVersion = plugin.versions.find((v) => v.id === plugin.version.id) || plugin.version;
					return this.checkInstallation(plugin);
				}),
				catchError((error) => this.handleError(error)),
				takeUntil(this.destroy$)
			)
			.subscribe();
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
				if (this.installing$.value) {
					this.pluginService
						.install({ pluginId: this.pluginId, versionId: this.selectedVersion.id })
						.pipe(
							concatMap(() => this.loadPlugin()),
							finalize(() => this.installing$.next(false)),
							catchError((error) => {
								console.warn('Installation failed, rollback');
								this.pluginElectronService.uninstall(this.plugin$.value as any);
								this.toastrService.error(error);
								return EMPTY;
							})
						)
						.subscribe();
				}
				if (this.uninstalling$.value) {
					this.pluginService
						.uninstall(this.pluginId)
						.pipe(
							concatMap(() => this.loadPlugin()),
							finalize(() => this.uninstalling$.next(false)),
							catchError((error) => {
								this.toastrService.error(error);
								return EMPTY;
							})
						)
						.subscribe();
				}
				this.toastrService.success(notification.message);
				break;
			case 'error':
				this.installing$.next(false);
				this.uninstalling$.next(this.installing$.value);
				this.toastrService.error(notification.message);
				break;
			case 'inProgress':
				this.installing$.next(!this.uninstalling$.value);
				this.toastrService.info(notification.message);
				break;
			default:
				this.installing$.next(false);
				this.uninstalling$.next(this.installing$.value);
				this.toastrService.warn('Unexpected Status');
				break;
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	async loadPlugin(): Promise<void> {
		this.loading$.next(true);
		this.pluginService
			.getOne(this.pluginId, {
				relations: ['versions', 'versions.source', 'uploadedBy', 'uploadedBy.user'],
				order: { versions: { releaseDate: 'DESC' } }
			})
			.pipe(
				tap((plugin: IPlugin) => this.plugin$.next(plugin)),
				catchError((error) => this.handleError(error)),
				finalize(() => this.loading$.next(false)),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	private async handleError(error: any): Promise<void> {
		this.toastrService.error(error);
		await this.router.navigate(['/settings/marketplace-plugins']);
	}

	async checkInstallation(plugin: IPlugin): Promise<void> {
		if (!plugin) return;

		try {
			const installed = await this.pluginElectronService.checkInstallation(plugin.id);
			this.installed$.next(!!installed);

			if (installed && plugin.versions) {
				this.needUpdate$.next(installed.version !== plugin.version.number);
			}
		} catch (error) {
			console.warn('No local installation found');
			this.installed$.next(false);
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

		try {
			await firstValueFrom(this.pluginService.update(this.pluginId, { status }));
			this.toastrService.success(this.translateService.instant('PLUGIN.MESSAGES.STATUS_UPDATED'));
		} catch (error) {
			this.toastrService.error(this.translateService.instant('COMMON.UPDATE_FAILED'));
		}
	}

	navigateToEdit(): void {
		if (!this.plugin$.value) return;

		this.dialogService
			.open(PluginMarketplaceUploadComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin$.value }
			})
			.onClose.pipe(
				filter(Boolean),
				tap(() => this.editing$.next(true)),
				switchMap((plugin: IPlugin) =>
					this.pluginService.update(this.pluginId, plugin).pipe(
						tap(() => this.toastrService.success('Plugin updated successfully!')),
						finalize(() => this.editing$.next(false)),
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

	navigateToHistory(): void {
		this.router.navigate(['settings', 'marketplace-plugins', this.pluginId, 'versions']);
	}

	formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user.employee?.id === this.plugin$.value?.uploadedBy?.id;
	}

	async onVersionChange(): Promise<void> {
		await this.checkInstallation(this.plugin$.value);
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
						title: 'Uninstall',
						message: 'Would you like to uninstall this plugin?',
						status: 'basic'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(async () => {
					this.uninstalling$.next(true);
					this.pluginElectronService.uninstall(this.plugin$.value as any);
				})
			)
			.subscribe();
	}

	installPlugin(isUpdate = false): void {
		this.installing$.next(true);
		const source = isUpdate ? this.plugin$.value.source : this.selectedVersion.source;

		switch (source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.pluginElectronService.downloadAndInstall({
					url: source.url,
					contextType: 'cdn',
					marketplaceId: this.pluginId
				});
				break;
			case PluginSourceType.NPM:
				this.pluginElectronService.downloadAndInstall({
					...{
						pkg: {
							name: source.name,
							version: isUpdate ? this.plugin$.value.version.number : this.selectedVersionNumber
						},
						registry: {
							privateURL: source.registry,
							authToken: source.authToken
						}
					},
					contextType: 'npm',
					marketplaceId: this.pluginId
				});
				break;
			default:
				this.installing$.next(false);
				break;
		}
	}

	public get selectedVersionNumber(): ID {
		return this.selectedVersion.number;
	}

	public addVersion(): void {
		if (!this.plugin$.value || !this.isOwner || !this.pluginId) return;

		this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin$.value }
			})
			.onClose.pipe(
				filter(Boolean),
				tap(() => this.adding$.next(true)),
				switchMap((version: IPluginVersion) =>
					this.pluginService.addVersion(this.pluginId, version).pipe(
						tap(() => this.toastrService.success('New version created successfully!')),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						}),
						finalize(() => this.adding$.next(false))
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
				tap(() => this.deleting$.next(true)),
				switchMap(() =>
					this.pluginService.delete(this.pluginId).pipe(
						tap(() => this.toastrService.success('Plugin deleted successfully!')),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						}),
						finalize(() => this.deleting$.next(false))
					)
				)
			)
			.subscribe();
	}

	public get disabled(): boolean {
		return;
	}
}
