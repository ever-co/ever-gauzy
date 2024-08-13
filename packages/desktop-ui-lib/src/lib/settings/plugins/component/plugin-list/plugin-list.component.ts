import { Component, inject, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Angular2SmartTableComponent, Cell, LocalDataSource } from 'angular2-smart-table';
import { BehaviorSubject, concatMap, filter, from, Observable, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../services';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import { AddPluginComponent } from '../add-plugin/add-plugin.component';
import { PluginStatusComponent } from './plugin-status/plugin-status.component';
import { PluginUpdateComponent } from './plugin-update/plugin-update.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-plugin-list',
	templateUrl: './plugin-list.component.html',
	styleUrls: ['./plugin-list.component.scss']
})
export class PluginListComponent implements OnInit {
	private readonly translateService = inject(TranslateService);
	private readonly pluginElectronService = inject(PluginElectronService);
	private readonly toastrNotificationService = inject(ToastrNotificationService);
	private readonly dialog = inject(NbDialogService);
	private readonly router = inject(Router);
	private readonly ngZone = inject(NgZone);

	public plugins$ = new BehaviorSubject<IPlugin[]>([]);
	public plugin: IPlugin = null;
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

	public readonly smartTableSettings = {
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
		this.observePlugins();
		this.loadPlugins();
	}

	private observePlugins(): void {
		this.pluginElectronService.status
			.pipe(
				tap((response) => this.ngZone.run(() => this.handleStatus(response))),
				filter((response) => response.status === 'success'),
				switchMap(() => from(this.pluginElectronService.plugins)),
				tap((plugins) => this.ngZone.run(() => (this.plugins = plugins))),
				untilDestroyed(this)
			)
			.subscribe();
		this.plugins$
			.pipe(
				tap(() => this.clearItem()),
				tap(() => (this.plugin = null)),
				concatMap((plugins) => this.sourceData.load(plugins)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private handleStatus(notification: { status: string; message?: string }) {
		switch (notification.status) {
			case 'success':
				this.processing = false;
				this.toastrNotificationService.success(notification.message);
				break;
			case 'error':
				this.processing = false;
				this.toastrNotificationService.error(notification.message);
				break;
			case 'inProgress':
				this.processing = true;
				this.toastrNotificationService.info(notification.message);
				break;
			default:
				this.processing = false;
				this.toastrNotificationService.warn('Unexpected Status');
				break;
		}
	}

	private loadPlugins(): void {
		from(this.pluginElectronService.plugins)
			.pipe(
				tap((plugins) => this.ngZone.run(() => (this.plugins = plugins))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public handleRowSelection({ isSelected, data }) {
		this.plugin = isSelected ? data : null;
	}

	public changeStatus() {
		this.processing = true;
		if (this.plugin.isActivate) {
			this.pluginElectronService.deactivate(this.plugin);
		} else {
			this.pluginElectronService.activate(this.plugin);
		}
		this.plugin = null;
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
		this.processing = true;
		this.pluginElectronService.uninstall(this.plugin);
		this.plugin = null;
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

	private get plugins(): IPlugin[] {
		return this.plugins$.getValue();
	}

	private set plugins(plugins: IPlugin[]) {
		this.plugins$.next(plugins);
	}
}
