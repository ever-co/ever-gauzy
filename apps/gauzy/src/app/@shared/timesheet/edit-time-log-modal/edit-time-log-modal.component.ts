import { Component, OnInit, Input, OnDestroy, AfterViewInit } from '@angular/core';
import {
	IDateRange,
	IOrganization,
	ITimeLog,
	IEmployee,
	PermissionsEnum,
	IGetTimeLogConflictInput,
	ISelectedEmployee,
	TimeLogType,
	TimeLogSourceEnum
} from '@gauzy/contracts';
import { toUTC, toLocal, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ToastrService } from '@gauzy/ui-sdk/core';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import * as _ from 'underscore';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { TimesheetService } from '../timesheet.service';
import { Store } from '@gauzy/ui-sdk/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-time-log-modal',
	templateUrl: './edit-time-log-modal.component.html',
	styleUrls: ['./edit-time-log-modal.component.scss']
})
export class EditTimeLogModalComponent implements OnInit, AfterViewInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	mode: 'create' | 'update' = 'create';
	loading: boolean;
	overlaps: ITimeLog[] = [];

	selectedRange: IDateRange = { start: null, end: null };
	timeDiff: Date = null;
	organization: IOrganization;

	employee: ISelectedEmployee;
	employees: IEmployee[];
	futureDateAllowed: boolean;
	subject$: Subject<any> = new Subject();

	changeSelectedEmployee: boolean;

	private _timeLog: ITimeLog | Partial<ITimeLog>;
	get timeLog(): ITimeLog | Partial<ITimeLog> {
		return this._timeLog;
	}
	@Input() set timeLog(value: ITimeLog | Partial<ITimeLog>) {
		this._timeLog = Object.assign({}, value);
		this.mode = this._timeLog && this._timeLog.id ? 'update' : 'create';
	}

	/*
	 * TimeLog Mutation Form
	 */
	public form: UntypedFormGroup = EditTimeLogModalComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: EditTimeLogModalComponent): UntypedFormGroup {
		return fb.group({
			isBillable: [true],
			employeeId: [],
			projectId: [],
			organizationContactId: [],
			taskId: [],
			description: [],
			reason: [],
			selectedRange: [self.selectedRange]
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly timesheetService: TimesheetService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly dialogRef: NbDialogRef<EditTimeLogModalComponent>
	) {
		const minutes = moment().get('minutes');
		const roundTime = moment().subtract(minutes - (minutes % 10));

		this.selectedRange = {
			end: roundTime.toDate(),
			start: roundTime.subtract(1, 'hour').toDate()
		};
	}

	ngAfterViewInit(): void {
		if (this._timeLog) {
			setTimeout(() => {
				this.form.setValue({
					isBillable: this._timeLog.isBillable || true,
					employeeId: this._timeLog.employeeId || this.store.selectedEmployee.id,
					projectId: this._timeLog.projectId || null,
					organizationContactId: this._timeLog.organizationContactId || null,
					taskId: this._timeLog.taskId || null,
					description: this._timeLog.description || null,
					reason: this._timeLog.reason || null,
					selectedRange: {
						start: this._timeLog.startedAt,
						end: this._timeLog.stoppedAt
					}
				});
			}, 200);
		}
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.checkOverlaps()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap((organization: IOrganization) => {
					this.futureDateAllowed = organization.futureDateAllowed;
				}),
				untilDestroyed(this)
			)
			.subscribe();
		const employeeId$ = this.form.get('employeeId').valueChanges;
		const selectedRange$ = this.form.get('selectedRange').valueChanges;
		combineLatest([employeeId$, selectedRange$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				tap(([employeeId, selectedRange]) => {
					const { start, end } = selectedRange;
					const startMoment = moment(start);
					const endMoment = moment(end);
					if (!startMoment.isValid() || !endMoment.isValid()) {
						return (this.timeDiff = null);
					}
					this.timeDiff = new Date(endMoment.diff(startMoment, 'seconds'));
				}),
				filter(([employeeId, selectedRange]) => !!employeeId && !!selectedRange),
				tap(([employeeId, selectedRange]) => {
					this.employee = employeeId;
					this.selectedRange = selectedRange;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	close() {
		this.dialogRef.close(null);
	}

	async checkOverlaps() {
		if (!this.organization) {
			return;
		}

		const { employeeId } = this.form.getRawValue();
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (this.selectedRange && employeeId) {
			const { start, end } = this.selectedRange;
			const startDate = toUTC(start).toISOString();
			const endDate = toUTC(end).toISOString();

			if (!startDate || !endDate) {
				return;
			}
			const request: IGetTimeLogConflictInput = {
				...(this.timeLog.id ? { ignoreId: [this.timeLog.id] } : {}),
				startDate,
				endDate,
				employeeId,
				tenantId,
				organizationId,
				relations: ['project', 'task']
			};
			try {
				const timeLogs = await this.timesheetService.checkOverlaps(request);
				if (!timeLogs) {
					return;
				}
				this.overlaps = timeLogs.map((timeLog: ITimeLog) => {
					const timeLogStartedAt = toLocal(timeLog.startedAt);
					const timeLogStoppedAt = toLocal(timeLog.stoppedAt);
					let overlapDuration = 0;
					if (moment(timeLogStartedAt).isBetween(moment(startDate), moment(endDate))) {
						if (moment(timeLogStoppedAt).isBetween(moment(startDate), moment(endDate))) {
							overlapDuration = moment(timeLogStoppedAt).diff(moment(timeLogStartedAt), 'seconds');
						} else {
							overlapDuration = moment(endDate).diff(moment(timeLogStartedAt), 'seconds');
						}
					} else {
						if (moment(timeLogStoppedAt).isBetween(moment(startDate), moment(endDate))) {
							overlapDuration = moment(timeLogStoppedAt).diff(moment(startDate), 'seconds');
						} else {
							overlapDuration = moment(endDate).diff(moment(startDate), 'seconds');
						}
					}
					timeLog['overlapDuration'] = overlapDuration;
					return timeLog;
				});
			} catch (error) {
				console.log('Error while checking overlapping time log entries for employee', error);
				this.toastrService.danger(error);
			}
		}
	}

	async addTime() {
		if (this.form.invalid) {
			return;
		}
		this.loading = true;
		try {
			const { employee } = this.store.user;
			const { id: organizationId, tenantId } = this.organization;

			const { start, end } = this.selectedRange;
			const startedAt = toUTC(start).toDate();
			const stoppedAt = toUTC(end).toDate();

			const payload = {
				..._.omit(this.form.value, ['selectedRange']),
				startedAt,
				stoppedAt,
				organizationId,
				tenantId,
				logType: TimeLogType.MANUAL,
				source: TimeLogSourceEnum.WEB_TIMER
			};

			if (!payload.employeeId) {
				payload.employeeId = employee?.id;
			}

			if (this.mode === 'create') {
				const timeLog = await this.timesheetService.addTime(payload);
				this.dialogRef.close(timeLog);
			} else {
				const timeLog = await this.timesheetService.updateTime(this.timeLog.id, payload);
				this.dialogRef.close(timeLog);
			}

			this.form.reset();
			this.selectedRange = { start: null, end: null };
			this.toastrService.success('TIMER_TRACKER.ADD_TIME_SUCCESS');
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.loading = false;
		}
	}

	onDeleteConfirm(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		const employee = timeLog.employee;
		const { id: organizationId, name } = this.organization;
		const request = {
			logIds: [timeLog.id],
			organizationId
		};
		this.timesheetService.deleteLogs(request).then((res) => {
			this.toastrService.success('TOASTR.MESSAGE.TIME_LOG_DELETED', {
				name: employee.fullName,
				organization: name
			});
			this.dialogRef.close(res);
		});
	}

	getControlValue(control: string): string {
		return this.form.get(control).value;
	}

	ngOnDestroy(): void {}
}
