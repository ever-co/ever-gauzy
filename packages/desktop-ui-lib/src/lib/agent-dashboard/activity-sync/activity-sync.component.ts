import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { combineLatest, Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { QueueItem, SyncHealth } from '../models/logs.models';
import { LogService } from '../services/logs.service';
import { Angular2SmartTableComponent, Cell, LocalDataSource } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { StatusBadgeComponent } from './activity-render/status-render';
import { LocalDateParse } from '../pipes/date.pipe';
import { NbDialogService } from '@nebular/theme';
import { StatusMapper } from '../../shared/utils/queue-status-mapper.util';

@Component({
	selector: 'app-sync-page',
	templateUrl: './activity-sync.component.html',
	styleUrls: ['./activity-sync.component.scss'],
	standalone: false
})
export class SyncPageComponent implements OnInit, OnDestroy {
	items$: Observable<QueueItem[]> = this.svc.queueStream$;
	health$: Observable<SyncHealth> = this.svc.healthStream$;
	tab: 'PENDING' | 'FAILED' | 'SYNCED' | 'PROCESS' = 'PENDING';

	currentFilter = {
		field: 'status',
		search: ''
	};

	private _smartTable: Angular2SmartTableComponent;
	public smartTableSource: LocalDataSource;
	public smartTableSettings: any;
	public loading$!: Observable<boolean>;
	private destroy$ = new Subject<void>();

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
	) {}

	ngOnInit(): void {
		this.loadSmartTableSettings();
		this.smartTableSource = new LocalDataSource();
		combineLatest([this.items$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(([items]) => {
				this.smartTableSource.load(items);
				if (this.currentFilter.search) {
					this.smartTableSource.setFilter([this.currentFilter], false);
				}
			});
	}

	clearSynced() {
		this.svc.clearSynced();
	}

	onChangeTab(tab: 'PENDING' | 'FAILED' | 'SYNCED' | 'PROCESS') {
		this.tab = tab;
		this.svc.getHistorySync(StatusMapper.getStatusForTab(tab));
		this.currentFilter.search = StatusMapper.getStatusForTab(tab);

		if (this.currentFilter.search) {
			this.smartTableSource.setFilter([this.currentFilter], false);
		} else {
			this.smartTableSource.reset(); // show all
		}
	}

	private dateParse(dateString: string) {
		return new LocalDateParse().transform(dateString);
	}

	private loadSmartTableSettings(): void {
		this.smartTableSettings = {
			columns: {
				queue: {
					title: this.translateService.instant('SM_TABLE.QUEUE'),
					width: '15%'
				},
				status: {
					title: this.translateService.instant('SM_TABLE.STATUS'),
					width: '10%',
					type: 'custom',
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					}
				},
				attempts: {
					title: this.translateService.instant('SM_TABLE.ATTEMPTS'),
					width: '10%'
				},
				created_at: {
					title: this.translateService.instant('SM_TABLE.CREATED_AT'),
					width: '25%',
					valuePrepareFunction: this.dateParse
				},
				last_error: {
					title: this.translateService.instant('SM_TABLE.LAST_ERROR'),
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
		import('./activity-sync-detail-modal/activity-sync-detail-modal.component').then((m) => {
			this.dialogService.open(m.ActivitySyncDetailModalComponent, {
				context: {
					data: event.data
				},
				closeOnBackdropClick: true
			});
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
