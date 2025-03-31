import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, NgZone, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { IPlugin, PluginSourceType } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, finalize, from, Observable, switchMap, tap } from 'rxjs';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { PluginService } from '../../../services/plugin.service';
import { IPlugin as IPluginInstalled } from '../../../services/plugin-loader.service';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';

@UntilDestroy()
@Component({
	selector: 'lib-plugin-marketplace-detail',
	templateUrl: './plugin-marketplace-detail.component.html',
	styleUrls: ['./plugin-marketplace-detail.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceDetailComponent implements OnInit {
	@Input() plugin!: IPlugin;
	public readonly _isChecked$ = new BehaviorSubject<boolean>(false);
	private readonly pluginElectronService = inject(PluginElectronService);
	private readonly pluginService = inject(PluginService);
	private readonly dialog = inject(NbDialogService);
	private readonly toastrService = inject(ToastrNotificationService);
	private readonly router = inject(Router);
	private readonly store = inject(Store);
	private readonly ngZone = inject(NgZone);
	public readonly installing$ = new BehaviorSubject<boolean>(false);
	public readonly uninstalling$ = new BehaviorSubject<boolean>(false);
	public readonly editing$ = new BehaviorSubject<boolean>(false);
	@Output() finish = new EventEmitter<void>();

	ngOnInit(): void {
		if (this.plugin) {
			// Set selector position
			this._isChecked$.next(this.plugin.installed);
			// Check if plugin is installed locally
			from(this.checkInstallation(this.plugin))
				.pipe(
					tap((installed) => this._isChecked$.next(!!installed)),
					catchError(() => {
						this._isChecked$.next(false);
						return EMPTY;
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}

		this.pluginElectronService.status
			.pipe(
				distinctUntilChange(),
				tap(({ status, message }) =>
					this.ngZone.run(() => {
						this.handleStatus({ status, message });
					})
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async checkInstallation(plugin: IPlugin): Promise<IPluginInstalled> {
		if (!plugin) return;
		try {
			return this.pluginElectronService.checkInstallation(plugin.id);
		} catch (error) {
			return null;
		}
	}

	private handleStatus(notification: { status: string; message?: string }) {
		switch (notification.status) {
			case 'success':
				if (this.installing$.value) {
					this.pluginService
						.install({ pluginId: this.plugin.id, versionId: this.plugin.version.id })
						.pipe(
							tap(() => {
								this.finish.emit();
								this._isChecked$.next(true);
							}),
							finalize(() => this.installing$.next(false)),
							catchError((error) => {
								console.warn('Installation failed, rollback');
								this.pluginElectronService.uninstall(this.plugin as any);
								this.toastrService.error(error);
								this._isChecked$.next(false);
								return EMPTY;
							}),
							untilDestroyed(this)
						)
						.subscribe();
				}
				if (this.uninstalling$.value) {
					this.pluginService
						.uninstall(this.plugin.id)
						.pipe(
							tap(() => {
								this.finish.emit();
								this._isChecked$.next(false);
							}),
							finalize(() => this.uninstalling$.next(false)),
							catchError((error) => {
								this.toastrService.error(error);
								this._isChecked$.next(true);
								return EMPTY;
							}),
							untilDestroyed(this)
						)
						.subscribe();
				}
				this.toastrService.success(notification.message);
				break;
			case 'error':
				if (this.installing$.value || this.uninstalling$.value) {
					this._isChecked$.next(!this._isChecked$.value);
				}
				this.installing$.next(false);
				this.uninstalling$.next(false);
				this.toastrService.error(notification.message);
				break;
			case 'inProgress':
				this.toastrService.info(notification.message);
				break;
			default:
				this.installing$.next(false);
				this.uninstalling$.next(this.installing$.value);
				this.toastrService.warn('Unexpected Status');
				break;
		}
	}

	public togglePlugin(checked: boolean): void {
		this._isChecked$.next(checked);
		checked ? this.installPlugin() : this.uninstallPlugin();
	}

	private installPlugin(): void {
		this.installing$.next(true);
		switch (this.plugin.source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.pluginElectronService.downloadAndInstall({
					url: this.plugin.source.url,
					contextType: 'cdn',
					marketplaceId: this.plugin.id
				});
				break;
			case PluginSourceType.NPM:
				this.pluginElectronService.downloadAndInstall({
					...{
						pkg: {
							name: this.plugin.source.name,
							version: this.plugin.version.number
						},
						registry: {
							privateURL: this.plugin.source.registry,
							authToken: this.plugin.source.authToken
						}
					},
					contextType: 'npm',
					marketplaceId: this.plugin.id
				});
				break;
			default:
				break;
		}
	}

	public get isChecked$(): Observable<boolean> {
		return this._isChecked$.asObservable();
	}

	public async openPlugin(): Promise<void> {
		if ('marketplaceId' in this.plugin) {
			if (!this.plugin.marketplaceId) {
				this.dialog.open(AlertComponent, {
					context: {
						data: {
							message: 'This plugin is not published yet',
							title: 'Plugin not published',
							status: 'basic'
						}
					},
					backdropClass: 'backdrop-blur'
				});
				return;
			}
		}
		await this.router.navigate([`/settings/marketplace-plugins/${this.plugin.id}`]);
	}

	public editPlugin(): void {
		this.dialog
			.open(PluginMarketplaceUploadComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					plugin: this.plugin
				}
			})
			.onClose.pipe(
				filter(Boolean),
				tap(() => this.editing$.next(true)),
				switchMap((plugin: IPlugin) =>
					this.pluginService.update(this.plugin.id, plugin).pipe(
						tap(() => this.toastrService.success('Plugin updated successfully!')),
						finalize(() => this.editing$.next(false)),
						catchError(() => {
							this.toastrService.error('Plugin upload failed!');
							return EMPTY;
						})
					)
				)
			)
			.subscribe();
	}

	private uninstallPlugin(): void {
		this.dialog
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
			.onClose.subscribe(async (isUninstall: boolean) => {
				const plugin = await this.checkInstallation(this.plugin);
				if (isUninstall && !!plugin) {
					this.uninstalling$.next(true);
					this.pluginElectronService.uninstall(plugin);
				} else {
					this._isChecked$.next(true);
				}
			});
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user.employee?.id === this.plugin?.uploadedById;
	}
}
