import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IPlugin, IPluginSource, IPluginVersion, PluginSourceType } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, from, map, Observable, of, switchMap, take, tap } from 'rxjs';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { IPlugin as IPluginInstalled } from '../../../services/plugin-loader.service';
import { DialogInstallationValidationComponent } from '../plugin-marketplace-item/dialog-installation-validation/dialog-installation-validation.component';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';

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

	public installPlugin(isUpdate = false): void {
		const installation$ = this.createInstallationObservable(isUpdate);
		installation$.subscribe({
			error: (err) => this.handleInstallationError(err)
		});
	}

	private createInstallationObservable(isUpdate: boolean): Observable<void> {
		return this.dialog
			.open(DialogInstallationValidationComponent, {
				context: { pluginId: this.plugin.id },
				backdropClass: 'backdrop-blur'
			})
			.onClose.pipe(
				take(1),
				switchMap((data) => this.handleDialogResponse(data, isUpdate)),
				catchError((err) => {
					this.handleInstallationError(err);
					return EMPTY;
				})
			);
	}

	private handleDialogResponse(data: any, isUpdate: boolean): Observable<void> {
		if (!data) {
			return this.handleDialogCloseWithoutData();
		}

		return of(data).pipe(
			filter(Boolean),
			tap(({ version, source, authToken }) => {
				this.preparePluginInstallation(version, source, isUpdate, authToken);
			})
		);
	}

	private handleDialogCloseWithoutData(): Observable<never> {
		this.action.dispatch(
			PluginInstallationActions.toggle({
				isChecked: false,
				plugin: this.plugin
			})
		);
		return EMPTY;
	}

	private handleInstallationError(err: any): void {
		console.error('Plugin installation failed:', err);
	}

	public preparePluginInstallation(
		version: IPluginVersion,
		source: IPluginSource,
		isUpdate = false,
		authToken: string
	): void {
		this.action.dispatch(PluginInstallationActions.toggle({ isChecked: true, plugin: this.plugin }));
		switch (source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.action.dispatch(
					PluginInstallationActions.install({
						url: source.url,
						contextType: 'cdn',
						marketplaceId: this.plugin.id,
						versionId: version.id
					})
				);
				break;
			case PluginSourceType.NPM:
				this.action.dispatch(
					PluginInstallationActions.install({
						...{
							pkg: {
								name: source.name,
								version: isUpdate ? this.plugin.version.number : version.number
							},
							registry: {
								privateURL: source.registry,
								authToken
							}
						},
						contextType: 'npm',
						marketplaceId: this.plugin.id,
						versionId: version.id
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
