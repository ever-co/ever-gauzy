import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { QueueItem } from '../agent-dashboard/models/logs.models';
import { LogService } from '../agent-dashboard/services/logs.service';
import { ElectronService } from '../electron/services';
import { LocalDataSource, Angular2SmartTableModule } from 'angular2-smart-table';
import { StatusBadgeComponent } from '../agent-dashboard/activity-sync/activity-render/status-render';
import { LocalDateParse } from '../agent-dashboard/pipes/date.pipe';
import { NbDialogService, NbCardModule, NbSelectModule, NbOptionModule, NbInputModule, NbBadgeModule, NbIconModule, NbButtonModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Cell } from 'angular2-smart-table';

@Component({
	selector: 'app-audit-trail-logger',
	templateUrl: './logger.component.html',
	styleUrls: ['./logger.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NbCardModule,
		NbSelectModule,
		NbOptionModule,
		NbInputModule,
		NbBadgeModule,
		NbIconModule,
		NbButtonModule,
		NbSpinnerModule,
		NbTooltipModule,
		AsyncPipe,
		DatePipe,
		NgClass,
		Angular2SmartTableModule
	]
})
export class AuditTrailLoggerComponent implements OnInit, OnDestroy {
	entries$: Observable<QueueItem[]> = this.logService.queueStream$;
	selectedStatus: string = 'all';
	isLoading$ = new BehaviorSubject<boolean>(false);
	smartTableSource: LocalDataSource = new LocalDataSource();
	smartTableSettings: object = {};
	private destroy$ = new Subject<void>();

	constructor(
		private readonly logService: LogService,
		private readonly electronService: ElectronService,
		private readonly dialogService: NbDialogService
	) {}

	ngOnInit(): void {
		this.buildTableSettings();
		this.loadEntries('all');

		this.entries$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
			this.smartTableSource.load(items || []);
		});

		if (this.electronService.ipcRenderer) {
			this.electronService.ipcRenderer.on('DASHBOARD_EVENT', (_event: unknown, payload: { type: string; data: unknown }) => {
				if (payload?.type === 'api_sync_update') {
					this.logService.updateApiLogs(payload.data as Parameters<typeof this.logService.updateApiLogs>[0]);
				}
			});
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		if (this.electronService.ipcRenderer) {
			this.electronService.ipcRenderer.removeAllListeners('DASHBOARD_EVENT');
		}
	}

	onStatusChange(status: string): void {
		this.selectedStatus = status;
		this.loadEntries(status);
	}

	async loadEntries(status: string): Promise<void> {
		this.isLoading$.next(true);
		try {
			await this.logService.getHistorySync(status === 'all' ? 'succeeded' : status);
		} finally {
			this.isLoading$.next(false);
		}
	}

	onRowClick(event: { data: QueueItem }): void {
		import('../agent-dashboard/activity-sync/activity-sync-detail-modal/activity-sync-detail-modal.component').then((m) => {
			this.dialogService.open(m.ActivitySyncDetailModalComponent, {
				context: { data: event.data },
				closeOnBackdropClick: true
			});
		});
	}

	private dateParse(dateString: string): string {
		return new LocalDateParse().transform(dateString);
	}

	private buildTableSettings(): void {
		this.smartTableSettings = {
			columns: {
				queue: {
					title: 'Queue',
					width: '15%'
				},
				status: {
					title: 'Status',
					width: '10%',
					type: 'custom',
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					}
				},
				attempts: {
					title: 'Attempts',
					width: '8%'
				},
				created_at: {
					title: 'Created At',
					width: '20%',
					valuePrepareFunction: this.dateParse
				},
				last_error: {
					title: 'Last Error',
					width: '47%'
				}
			},
			hideSubHeader: true,
			actions: false,
			noDataMessage: 'No audit trail records found.',
			pager: {
				display: false,
				perPage: 200
			},
			rowClassFunction: () => 'clickable-row'
		};
	}
}
