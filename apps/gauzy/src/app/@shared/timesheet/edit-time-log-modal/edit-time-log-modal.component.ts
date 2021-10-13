import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	AfterViewInit
} from '@angular/core';
import {
	IDateRange,
	IOrganization,
	ITimeLog,
	IEmployee,
	PermissionsEnum,
	OrganizationPermissionsEnum,
	IGetTimeLogConflictInput,
	ISelectedEmployee
} from '@gauzy/contracts';
import { toUTC, toLocal } from '@gauzy/common-angular';
import { TimesheetService } from '../timesheet.service';
import { FormGroup, FormControl } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeesService, Store, ToastrService } from '../../../@core/services';
import * as moment from 'moment';
import * as _ from 'underscore';
import { NgxPermissionsService } from 'ngx-permissions';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { merge, Subject } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-time-log-modal',
	templateUrl: './edit-time-log-modal.component.html',
	styleUrls: ['./edit-time-log-modal.component.scss']
})
export class EditTimeLogModalComponent
	implements OnInit, AfterViewInit, OnDestroy {
		
	PermissionsEnum = PermissionsEnum;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	today: Date = new Date();
	mode: 'create' | 'update' = 'create';
	loading: boolean;
	overlaps: ITimeLog[] = [];

	selectedRange: IDateRange = { start: null, end: null };
	organization: IOrganization;

	employee: ISelectedEmployee;
	employees: IEmployee[];
	futureDateAllowed: boolean;
	subject$: Subject<any> = new Subject();

	form: FormGroup;
	changeSelectedEmployee: boolean;

	private _timeLog: ITimeLog | Partial<ITimeLog>;
	get timeLog(): ITimeLog | Partial<ITimeLog> {
		return this._timeLog;
	}
	@Input() set timeLog(value: ITimeLog | Partial<ITimeLog>) {
		this._timeLog = Object.assign({}, value);
		this.mode = this._timeLog && this._timeLog.id ? 'update' : 'create';
	}

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly toastrService: ToastrService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly store: Store,
		private readonly employeesService: EmployeesService,
		private readonly dialogRef: NbDialogRef<EditTimeLogModalComponent>
	) {
		const munutes = moment().get('minutes');
		const roundTime = moment().subtract(munutes - (munutes % 10));

		this.selectedRange = {
			end: roundTime.toDate(),
			start: roundTime.subtract(1, 'hour').toDate()
		};
		this._initializeForm();
	}

	ngAfterViewInit(): void {
		if (this._timeLog) {
			setTimeout(() => {
				this.form.setValue({
					isBillable: this._timeLog.isBillable || true,
					employeeId:
						this._timeLog.employeeId ||
						this.store.selectedEmployee.id,
					projectId: this._timeLog.projectId || null,
					organizationContactId:
						this._timeLog.organizationContactId || null,
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
				tap(() => this.getEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.changeSelectedEmployee = await this.ngxPermissionsService.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				);
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
			});

		merge(
			this.form.get('employeeId').valueChanges.pipe(
				tap((employeeId) => {
					this.employee = employeeId;
					return employeeId;
				})
			),
			this.form.get('selectedRange').valueChanges.pipe(
				tap((value: IDateRange) => {
					this.selectedRange = value;
					this.subject$.next(true);
					return value;
				})
			)
		)
			.pipe(
				debounceTime(500),
				untilDestroyed(this)
			)
			.subscribe(() => {
				if (
					this.selectedRange &&
					this.selectedRange.start &&
					this.selectedRange.end
				) {
					this.subject$.next(true);
					this.checkOverlaps();
				}
			});
	}

	private _initializeForm() {
		this.form = new FormGroup({
			isBillable: new FormControl(true),
			employeeId: new FormControl(null),
			projectId: new FormControl(null),
			organizationContactId: new FormControl(null),
			taskId: new FormControl(null),
			description: new FormControl(null),
			reason: new FormControl(null),
			selectedRange: new FormControl(this.selectedRange)
		});
	}

	close() {
		this.dialogRef.close(null);
	}

	checkOverlaps() {
		const { employeeId } = this.form.value;
		if (this.selectedRange && employeeId) {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const { start, end } = this.selectedRange;
			const startDate = toUTC(start).toISOString();
			const endDate = toUTC(end).toISOString();

			const request: IGetTimeLogConflictInput = {
				...(this.timeLog.id ? { ignoreId: [this.timeLog.id] } : {}),
				startDate,
				endDate,
				employeeId,
				tenantId,
				organizationId,
				relations: ['project', 'task']
			};

			this.timesheetService.checkOverlaps(request).then((timeLogs) => {
				this.overlaps = timeLogs.map((timeLog) => {
					const timeLogStartedAt = toLocal(timeLog.startedAt);
					const timeLogStoppedAt = toLocal(timeLog.stoppedAt);
					let overlapDuration = 0;
					if (
						moment(timeLogStartedAt).isBetween(
							moment(startDate),
							moment(endDate)
						)
					) {
						if (
							moment(timeLogStoppedAt).isBetween(
								moment(startDate),
								moment(endDate)
							)
						) {
							overlapDuration = moment(timeLogStoppedAt).diff(
								moment(timeLogStartedAt),
								'seconds'
							);
						} else {
							overlapDuration = moment(endDate).diff(
								moment(timeLogStartedAt),
								'seconds'
							);
						}
					} else {
						if (
							moment(timeLogStoppedAt).isBetween(
								moment(startDate),
								moment(endDate)
							)
						) {
							overlapDuration = moment(timeLogStoppedAt).diff(
								moment(startDate),
								'seconds'
							);
						} else {
							overlapDuration = moment(endDate).diff(
								moment(startDate),
								'seconds'
							);
						}
					}
					timeLog.overlapDuration = overlapDuration;
					return timeLog;
				});
			});
		}
	}

	addTime() {
		if (this.form.invalid) {
			return;
		}
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { start, end } = this.selectedRange;
		const startedAt = toUTC(start).toDate();
		const stoppedAt = toUTC(end).toDate();

		const payload = {
			..._.omit(this.form.value, ['selectedRange']),
			startedAt,
			stoppedAt,
			organizationId,
			tenantId
		};
		if (!payload.employeeId) {
			payload.employeeId = this.store.user.employeeId;
		}

		let request: Promise<any>;
		if (this.mode === 'create') {
			request = this.timesheetService.addTime(payload);
		} else {
			request = this.timesheetService.updateTime(this.timeLog.id, payload);
		}

		request
			.then((data) => {
				this.form.reset();
				this.dialogRef.close(data);
				this.selectedRange = { start: null, end: null };
				this.toastrService.success('TIMER_TRACKER.ADD_TIME_SUCCESS');
			})
			.catch((error) => {
				this.toastrService.error(error);
			})
			.finally(() => (this.loading = false));
	}

	onDeleteConfirm(log) {
		this.timesheetService.deleteLogs(log.id).then((res) => {
			this.dialogRef.close(res);
		});
	}

	getControlValue(control: string): string {
		return this.form.get(control).value;
	}

	getEmployees() {
		if (
			this.changeSelectedEmployee &&
			this.selectedRange &&
			this.selectedRange.start
		) {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { start } = this.selectedRange;

			this.employeesService
				.getWorking(
					organizationId,
					tenantId,
					start,
					true
				)
				.then(({ items }) => {
					this.employees = items;
				});
		}
	}

	ngOnDestroy(): void {}
}
