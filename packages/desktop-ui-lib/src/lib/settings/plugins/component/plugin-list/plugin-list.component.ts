import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Angular2SmartTableComponent, Cell, LocalDataSource } from 'angular2-smart-table';
import { BehaviorSubject, concatMap, filter, Observable, take, tap } from 'rxjs';
import { PluginActions } from '../+state/plugin.action';
import { PluginQuery } from '../+state/plugin.query';
import { AlertComponent } from '../../../../dialogs/alert/alert.component';
import { IPlugin } from '../../services/plugin-loader.service';
import { AddPluginComponent } from '../add-plugin/add-plugin.component';
import { PluginStatusComponent } from './plugin-status/plugin-status.component';
import { PluginUpdateComponent } from './plugin-update/plugin-update.component';
import { PluginInstallationActions } from '../plugin-marketplace/+state/actions/plugin-installation.action';
import { PluginInstallationQuery } from '../plugin-marketplace/+state/queries/plugin-installation.query';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-plugin-list',
    templateUrl: './plugin-list.component.html',
    styleUrls: ['./plugin-list.component.scss'],
    standalone: false
})
export class PluginListComponent implements OnInit, OnDestroy {
	private readonly translateService = inject(TranslateService);
	private readonly action = inject(Actions);
	public readonly query = inject(PluginQuery);
	public readonly installationQuery = inject(PluginInstallationQuery);
	private readonly dialog = inject(NbDialogService);
	private readonly router = inject(Router);

	public plugins$ = new BehaviorSubject<IPlugin[]>([]);
	private _sourceData$ = new BehaviorSubject(new LocalDataSource([]));

	public get sourceData$(): Observable<LocalDataSource> {
		return this._sourceData$.asObservable();
	}

	private get sourceData(): LocalDataSource {
		return this._sourceData$.getValue();
	}

	private _pluginTable: Angular2SmartTableComponent;
	public processing = false;

	@ViewChild('pluginTable') set pluginTable(content: Angular2SmartTableComponent) {
		if (content) {
			this._pluginTable = content;
			this.onChangedSource();
		}
	}

	public get pluginTable(): Angular2SmartTableComponent {
		return this._pluginTable;
	}

	public smartTableSettings = {
		columns: {
			name: {
				title: this.translateService.instant('SM_TABLE.NAME')
			},
			isActivate: {
				title: this.translateService.instant('SM_TABLE.STATUS'),
				type: 'custom',
				renderComponent: PluginStatusComponent,
				componentInitFunction: (instance: PluginStatusComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			version: {
				title: this.translateService.instant('TIMER_TRACKER.SETTINGS.VERSION')
			},
			updatedAt: {
				title: this.translateService.instant('TIMER_TRACKER.SETTINGS.UPDATE'),
				type: 'custom',
				renderComponent: PluginUpdateComponent,
				componentInitFunction: (instance: PluginUpdateComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			}
		},
		hideSubHeader: true,
		actions: false,
		noDataMessage: this.translateService.instant('SM_TABLE.NO_DATA.PLUGIN'),
		pager: {
			display: true,
			perPage: 10,
			page: 1
		}
	};

	ngOnInit(): void {
		this.reset();
		this.observePlugins();
		this.loadPlugins();
		this.onLanguageChange();
	}

	private observePlugins(): void {
		this.plugins$
			.pipe(
				tap(() => this.clearItem()),
				concatMap((plugins) => this.sourceData.load(plugins)),
				untilDestroyed(this)
			)
			.subscribe();

		this.query.plugins$
			.pipe(
				tap((plugins) => this.plugins$.next(plugins)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private loadPlugins(): void {
		this.action.dispatch(PluginActions.getPlugins());
	}

	public handleRowSelection({ isSelected, data }) {
		this.action.dispatch(PluginActions.selectPlugin(isSelected ? data : null));
	}

	public changeStatus() {
		if (!this.plugin) return;

		const { isActivate } = this.plugin;

		if (isActivate) {
			this.dialog
				.open(AlertComponent, {
					backdropClass: 'backdrop-blur',
					context: {
						data: {
							title: 'PLUGIN.DIALOG.DEACTIVATE.TITLE',
							message: 'PLUGIN.DIALOG.DEACTIVATE.DESCRIPTION',
							confirmText: 'PLUGIN.DIALOG.DEACTIVATE.CONFIRM',
							status: 'basic'
						}
					}
				})
				.onClose.pipe(
					take(1),
					filter(Boolean),
					tap(() => this.handlePluginAction(false))
				)
				.subscribe();
		} else {
			this.handlePluginAction(true);
		}
	}

	private handlePluginAction(activate: boolean) {
		activate
			? this.action.dispatch(PluginActions.activate(this.plugin))
			: this.action.dispatch(PluginActions.deactivate(this.plugin));
	}

	public view() {
		this.router.navigate(['/settings', 'plugins', this.plugin.name]);
	}

	public addPlugin() {
		this.dialog
			.open(AddPluginComponent, { backdropClass: 'backdrop-blur' })
			.onClose.pipe(untilDestroyed(this))
			.subscribe();
	}

	public uninstall() {
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
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => this.action.dispatch(PluginInstallationActions.uninstall(this.plugin)))
			)
			.subscribe();
	}

	private clearItem(): void {
		if (this.pluginTable && this.pluginTable.grid) {
			this.pluginTable.grid.dataSet['willSelect'] = 'indexed';
			this.pluginTable.grid.dataSet.deselectAll();
		}
	}

	private onChangedSource(): void {
		this.pluginTable.source.onChangedSource
			.pipe(
				tap(() => this.clearItem()),
				tap(() => {
					if (this.plugin) {
						this.pluginTable.grid.dataSet.getRows().forEach((row) => {
							if (row.getData().id === this.plugin.id) {
								this.pluginTable.grid.dataSet.selectRow(row);
							}
						});
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private onLanguageChange() {
		this.translateService.onLangChange
			.pipe(
				tap(() => {
					this.smartTableSettings = Object.assign({}, this.smartTableSettings);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get plugin(): IPlugin {
		return this.query.plugin;
	}

	public reset() {
		this.action.dispatch(PluginActions.selectPlugin(null));
	}

	public ngOnDestroy(): void {
		this.reset();
	}
}
