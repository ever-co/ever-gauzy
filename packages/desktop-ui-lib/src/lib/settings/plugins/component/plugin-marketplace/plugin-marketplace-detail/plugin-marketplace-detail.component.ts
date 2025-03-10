import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, Observable, switchMap, tap } from 'rxjs';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { IPlugin } from '../../../services/plugin-loader.service';
import { Router } from '@angular/router';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginService } from '../../../services/plugin.service';
import { PluginSourceType } from '@gauzy/contracts';

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

	ngOnInit(): void {
		if (this.plugin) {
			this._isChecked$.next(this.plugin.installed);
		}
	}

	public togglePlugin(checked: boolean): void {
		this._isChecked$.next(checked);
		checked ? this.installPlugin() : this.uninstallPlugin();
	}

	private installPlugin(): void {
		switch (this.plugin.source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.pluginElectronService.downloadAndInstall({ url: this.plugin.source.url, contextType: 'cdn' });
				break;
			case PluginSourceType.NPM:
				this.pluginElectronService.downloadAndInstall({
					...{
						pkg: {
							name: this.plugin.source.name,
							version: this.plugin.versions[this.plugin.versions.length - 1]
						},
						registry: {
							privateURL: this.plugin.source.registry,
							authToken: this.plugin.source.authToken
						}
					},
					contextType: 'npm'
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
		this.router.navigate([`/settings/marketplace-plugins/${this.plugin.id}`]);
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
				switchMap((plugin: IPlugin) =>
					this.pluginService.update(plugin).pipe(
						tap(() => this.toastrService.success('Plugin updated successfully!')),
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
			.onClose.subscribe((isUninstall: boolean) => {
				if (isUninstall) {
					this.pluginElectronService.uninstall(this.plugin);
					this._isChecked$.next(false);
				} else {
					this._isChecked$.next(true);
				}
			});
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user.employee?.id === this.plugin?.uploadedBy?.id;
	}
}
