import { NgClass, NgIf } from '@angular/common';
import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { DateRangePickerComponent } from '../../recap/shared/features/date-range-picker/date-range-picker.component';
import { IDateRangePicker } from '../../recap/shared/features/date-range-picker/date-picker.interface';
import { TimerSessionService } from './timer-session.service';
import { TimeTrackerService } from '../time-tracker.service';
import { ElectronService } from '../../electron/services';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ITimeLog, TimerActionTypeEnum, TimerSyncStateEnum } from '@gauzy/contracts';

export type SyncStatus = 'synced' | 'pending' | 'failed' | 'syncing' | 'removed';

export interface Session {
	id: number;
	day: number;
	duration: number;
	taskId: string | null;
	projectId: string | null;
	employeeId: string;
	timelogId: string | null;
	timesheetId: string | null;
	timeslotId: string | null;
	createdAt: string;
	updatedAt: string;
	startedAt: number;
	stoppedAt: number;
	synced: 0 | 1;
	isStartedOffline: 0 | 1;
	isStoppedOffline: 0 | 1;
	version: string;
	organizationTeamId: string | null;
	description: string | null;
	startSyncState: SyncStatus;
	stopSyncState: SyncStatus;
	syncDuration: number;
}

export interface SessionFilter {
	value: SyncStatus | 'all';
	label: string;
}

export const SYNC_CONFIG: Record<SyncStatus, { label: string; cssClass: string; icon: string }> = {
	synced: { label: 'Synced', cssClass: 'status-synced', icon: 'checkmark-circle-2-outline' },
	pending: { label: 'Pending', cssClass: 'status-pending', icon: 'clock-outline' },
	syncing: { label: 'Syncing', cssClass: 'status-syncing', icon: 'sync-outline' },
	failed: { label: 'Failed', cssClass: 'status-failed', icon: 'alert-circle-outline' },
	removed: { label: 'Removed', cssClass: 'status-failed', icon: 'alert-circle-outline' }
};

@Component({
	selector: 'gauzy-timer-session',
	templateUrl: './timer-session.component.html',
	styleUrls: ['./timer-session.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NgIf, NgClass, NbCardModule, NbIconModule, DateRangePickerComponent]
})
export class TimerSessionComponent {
	private readonly timerSessionService = inject(TimerSessionService);
	private readonly _electronService = inject(ElectronService);
	private readonly _timeTrackerService = inject(TimeTrackerService);
	sessions = signal<Session[]>([]);
	visibleTotal = '0s';

	searchQuery = '';

	showModal = false;
	editingSession: Session | null = null;
	syncConfig = SYNC_CONFIG;

	statusFilter = signal('all');

	currentRange = signal<{ start: Date; end: Date }>({
		start: new Date(new Date().setHours(0, 0, 0, 0)),
		end: new Date(new Date().setHours(23, 59, 59, 999))
	});

	selectedRange: IDateRangePicker;

	dateLabel = signal<string>('');

	filterOptions: SessionFilter[] = [
		{
			value: 'all',
			label: 'All'
		},
		{
			value: 'synced',
			label: 'Synced'
		},
		{
			value: 'pending',
			label: 'Pending'
		},
		{
			value: 'syncing',
			label: 'Syncing'
		},
		{
			value: 'failed',
			label: 'Failed'
		},
		{
			value: 'removed',
			label: 'Removed'
		}
	];

	private readonly destroy$ = new Subject<void>();
	private timesheets: any[] | null = [];

	readonly filteredSessions = computed(() => {
		const status = this.statusFilter();
		return this.sessions()
			.map((s) => {
				const timesheet = this.timesheets?.find((t) => t.id === s.timelogId);
				return {
					...s,
					projectName: timesheet?.project?.name || 'No Project',
					taskName: timesheet?.task?.title || 'No Task',
					clientName: timesheet?.organizationContact?.name || 'No Client',
					statusSync: this.statusSyncCheck(s, timesheet, this.timesheets === null)
				};
			})
			.filter((s) => {
				if (status === 'all') return true;
				return s.statusSync === status;
			});
	});

	private statusSyncCheck(session: Session, timeLog?: ITimeLog, offline?: boolean): SyncStatus {
		if (!offline) {
			if (session.timelogId && !timeLog?.id) {
				return 'removed';
			}
		}

		if (session.startSyncState === 'synced' && session.stopSyncState !== 'synced') {
			return session.stopSyncState || 'pending';
		}

		if (session.startSyncState !== 'synced') {
			return session.startSyncState || 'pending';
		}

		return session.startSyncState;
	}

	ngOnInit(): void {
		this._electronService.ipcRenderer.on('TIMER_SESSION_UPDATED', () => this.sessionUpdateHandler);
		this.selectedRange = {
			startDate: new Date(),
			endDate: new Date(),
			isCustomDate: false
		};
		this.timerSessionService.sessionsStream$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
			this.sessions.set(items);
		});
		this.loadLocalSessionsForRange();
		this.toDatetimeLocal();
	}

	sessionUpdateHandler(): void {
		// check current range same as now date if same then update session list else do nothing
		if (this.currentRange().start.toDateString() === new Date().toDateString()) {
			this.loadLocalSessionsForRange();
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		this._electronService.ipcRenderer.removeListener('TIMER_SESSION_UPDATED', this.sessionUpdateHandler);
	}

	setFilter(status: SyncStatus): void {
		this.statusFilter.set(status);
		this.loadLocalSessionsForRange();
	}

	exportCsv(): void {
		const header = 'ID,Started At,Stopped At,Duration (s),Sync State,Description';
		const rows = this.sessions().map(
			(s) =>
				`${s.id},"${new Date(s.startedAt).toISOString()}","${new Date(s.stoppedAt).toISOString()}",${s.duration},"${s.startSyncState}","${s.description ?? ''}"`
		);
		const csv = [header, ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = Object.assign(document.createElement('a'), { href: url, download: 'sessions.csv' });
		a.click();
		URL.revokeObjectURL(url);
	}

	getSyncStatus(session: Session): SyncStatus {
		if (session.synced) return 'synced';
		if (session.startSyncState === 'syncing' || session.stopSyncState === 'syncing') return 'syncing';
		if (session.startSyncState === 'failed' || session.stopSyncState === 'failed') return 'failed';
		return 'pending';
	}

	formatDatetime(ms: number): string {
		if (!ms) return 'now';
		return new Date(ms).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	formatSeconds(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0 && m > 0) return `${h}h ${m}m`;
		if (h > 0) return `${h}h`;
		if (m > 0 && s > 0) return `${m}m ${s}s`;
		if (m > 0) return `${m}m`;
		return `${s}s`;
	}

	private toDatetimeLocal(): void {
		this.dateLabel.set(this.currentRange().start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
	}

	async retrySync(session: Session) {
		const sessionDetail = await this.timerSessionService.getSession(session.id);
		await this._electronService.ipcRenderer.invoke('UPDATE_SYNC_STATE', {
			actionType: TimerActionTypeEnum.STOP_TIMER,
			data: {
				timerId: sessionDetail.id,
				state: TimerSyncStateEnum.SYNCING,
				timelogId: null
			}
		});
		const timeLog = await this._timeTrackerService.addTimeLog({
			startedAt: new Date(sessionDetail.startedAt),
			stoppedAt: new Date(sessionDetail.stoppedAt),
			description: sessionDetail.description,
			organizationContactId: sessionDetail.organizationTeamId,
			taskId: sessionDetail.taskId,
			projectId: sessionDetail.projectId
		});
		await this._electronService.ipcRenderer.invoke('UPDATE_SYNC_STATE', {
			actionType: TimerActionTypeEnum.STOP_TIMER,
			data: {
				timerId: sessionDetail.id,
				state: TimerSyncStateEnum.SYNCED,
				timelogId: timeLog.id
			}
		});
	}

	onRangeChange(range: { startDate?: string | Date; endDate?: string | Date }): void {
		const toLocalDayStart = (d: string | Date): Date => {
			const local = new Date(d);
			return new Date(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, 0);
		};
		const toLocalDayEnd = (d: string | Date): Date => {
			const local = new Date(d);
			return new Date(local.getFullYear(), local.getMonth(), local.getDate(), 23, 59, 59, 999);
		};

		this.currentRange.set({
			start: toLocalDayStart(range.startDate),
			end: toLocalDayEnd(range.endDate)
		});
		this.toDatetimeLocal();
		this.loadLocalSessionsForRange();
	}

	async loadLocalSessionsForRange(): Promise<void> {
		await this.getTimesheetsForRange();
		await this.timerSessionService.getSessionList(this.currentRange());
	}

	async getTimesheetsForRange(): Promise<any> {
		try {
			const timesheets = await this.timerSessionService.getTimesheets(this.currentRange());
			if (timesheets) {
				this.timesheets = timesheets;
			}

			console.log('Timesheets for range:', timesheets);
		} catch (error) {
			this.timesheets = null;
		}
	}
}
