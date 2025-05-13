import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IPlugin, PluginSourceType } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, filter, from, map, Observable, of, take, tap } from 'rxjs';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { IPlugin as IPluginInstalled } from '../../../services/plugin-loader.service';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';

@UntilDestroy()
@Component({
	selector: 'lib-plugin-marketplace-detail',
	templateUrl: './plugin-marketplace-detail.component.html',
	styleUrls: ['./plugin-marketplace-detail.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceDetailComponent implements OnInit {
	@Input()
	public plugin: IPlugin;
	private readonly _isChecked$ = new BehaviorSubject<boolean>(false);

	constructor(
		private readonly dialog: NbDialogService,
		private readonly router: Router,
		private readonly store: Store,
		private readonly action: Actions,
		private readonly pluginService: PluginElectronService,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly installationQuery: PluginInstallationQuery
	) {}

	ngOnInit(): void {
		// Set selector position
		this._isChecked$.next(this.plugin.installed);
		// Set selector on installation
		this.installationQuery.toggle$
			.pipe(
				filter(({ plugin }) => !!plugin && this.plugin.id === plugin.id),
				tap(({ isChecked }) => this._isChecked$.next(isChecked)),
				untilDestroyed(this)
			)
			.subscribe();
		// Check local installation
		this.check(this.plugin).subscribe((isChecked) => this._isChecked$.next(isChecked));
	}

	public check(plugin: IPlugin): Observable<boolean> {
		return from(this.checkInstallation(plugin)).pipe(
			map((installed) => !!installed), // Convert the result to a boolean directly
			catchError(() => of(false)), // Ensure the stream continues even on error
			untilDestroyed(this)
		);
	}

	public async checkInstallation(plugin: IPlugin): Promise<IPluginInstalled> {
		if (!plugin) return;
		try {
			return this.pluginService.checkInstallation(plugin.id);
		} catch (error) {
			return null;
		}
	}

	public togglePlugin(checked: boolean): void {
		this.action.dispatch(PluginInstallationActions.toggle({ isChecked: checked, plugin: this.plugin }));
		checked ? this.installPlugin() : this.uninstallPlugin();
	}

	private installPlugin(): void {
		switch (this.plugin.source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.action.dispatch(
					PluginInstallationActions.install({
						url: this.plugin.source.url,
						contextType: 'cdn',
						marketplaceId: this.plugin.id,
						versionId: this.plugin.version.id
					})
				);
				break;
			case PluginSourceType.NPM:
				this.action.dispatch(
					PluginInstallationActions.install({
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
						marketplaceId: this.plugin.id,
						versionId: this.plugin.version.id
					})
				);
				break;
			default:
				break;
		}
	}

	public get isChecked$(): Observable<boolean> {
		return this._isChecked$.asObservable();
	}

	public async openPlugin(): Promise<void> {
		this.action.dispatch(PluginVersionActions.selectVersion(this.plugin.version));
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
				take(1),
				filter(Boolean),
				tap((plugin: IPlugin) => this.action.dispatch(PluginMarketplaceActions.update(this.plugin.id, plugin)))
			)
			.subscribe();
	}

	private uninstallPlugin(): void {
		this.dialog
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
			.onClose.subscribe(async (isUninstall: boolean) => {
				const plugin = await this.checkInstallation(this.plugin);
				if (isUninstall && !!plugin) {
					this.action.dispatch(PluginInstallationActions.uninstall(plugin));
				} else {
					this._isChecked$.next(true);
				}
			});
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user.employee?.id === this.plugin?.uploadedById;
	}
}
