import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { QueueItem, SyncHealth } from '../models/logs.models';
import { LogService } from '../services/logs.service';
import { Angular2SmartTableComponent, Cell, LocalDataSource } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { StatusBadgeComponent } from './activity-render/status-render';
import { LocalDateParse } from '../pipes/date.pipe';
import { NbDialogService } from '@nebular/theme';

@Component({
	selector: 'app-sync-page',
	templateUrl: './activity-sync.component.html',
	styleUrls: ['./activity-sync.component.scss'],
	standalone: false
})
export class SyncPageComponent implements OnInit {
	items$: Observable<QueueItem[]> = this.svc.queueStream$;
	health$: Observable<SyncHealth> = this.svc.healthStream$;
	tab: 'PENDING' | 'FAILED' | 'SYNCED' | 'PROCESS' = 'PENDING';
	private _smartTable: Angular2SmartTableComponent;
	public smartTableSource: LocalDataSource;
	public smartTableSettings: any;
	public loading$!: Observable<boolean>;

	@ViewChild('smartTable')
	public set smartTable(content: Angular2SmartTableComponent) {
		if (content) {
			this._smartTable = content;
		}
	}
	public get smartTable(): Angular2SmartTableComponent {
		return this._smartTable;
	}
	constructor(
		private svc: LogService,
		private translateService: TranslateService,
		private dialogService: NbDialogService
	) { }

	ngOnInit(): void {
		this.loadSmartTableSettings();
		this.smartTableSource = new LocalDataSource();
	}

	clearSynced() { this.svc.clearSynced(); }

	onChangeTab(tab: 'PENDING' | 'FAILED' | 'SYNCED' | 'PROCESS') {
		this.tab = tab;
		const typeStatus = {
			PENDING: 'waiting',
			FAILED: 'failed',
			SYNCED: 'succeeded',
			PROCESS: 'running'
		}
		this.svc.getHistorySync(typeStatus[tab]);
		this.items$.subscribe((items) => {
			this.smartTableSource.load(items);
		});
	}

	private dateParse(dateString: string) {
		return new LocalDateParse().transform(dateString);
	}

	private loadSmartTableSettings(): void {
		this.smartTableSettings = {
			columns: {
				queue: {
					title: this.translateService.instant('Queue'),
					width: '15%'
				},
				status: {
					title: this.translateService.instant('Status'),
					width: '10%',
					type: 'custom',
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					}
				},
				attempts: {
					title: this.translateService.instant('Attempts'),
					width: '10%'
				},
				created_at: {
					title: this.translateService.instant('Created'),
					width: '25%',
					valuePrepareFunction: this.dateParse
				},
				last_error: {
					title: this.translateService.instant('Last Error'),
					width: '40%'
				}
			},
			hideSubHeader: true,
			actions: false,
			noDataMessage: this.translateService.instant('SM_TABLE.NO_DATA.TASK'),
			pager: {
				display: false,
				perPage: 200
			},
			rowClassFunction: () => 'clickable-row'
		};
	}

	onRowClick(event: any): void {
		import('./activity-sync-detail-modal/activity-sync-detail-modal.component').then(m => {
			this.dialogService.open(m.ActivitySyncDetailModalComponent, {
				context: {
					data: event.data
				},
				closeOnBackdropClick: true
			});
		});
	}


}
