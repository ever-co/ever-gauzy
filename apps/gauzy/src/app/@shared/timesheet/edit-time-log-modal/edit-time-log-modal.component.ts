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
	IGetTimeLogConflictInput
} from '@gauzy/contracts';
import { toUTC, toLocal } from '@gauzy/common';
import { TimesheetService } from '../timesheet.service';
import { FormGroup, FormControl } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../@core/services/toastr.service';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
import { EmployeesService } from '../../../@core/services';
import * as moment from 'moment';
import * as _ from 'underscore';
import { NgxPermissionsService } from 'ngx-permissions';
import { debounceTime, tap } from 'rxjs/operators';
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

	employee: SelectedEmployee;
	employees: IEmployee[];
	futureDateAllowed: boolean;
	loadEmployees$: Subject<any> = new Subject();

	form: FormGroup;

	private _timeLog: ITimeLog | Partial<ITimeLog>;
	changeSelectedEmployee: boolean;
	@Input()
	public get timeLog(): ITimeLog | Partial<ITimeLog> {
		return this._timeLog || {};
	}
	public set timeLog(value: ITimeLog | Partial<ITimeLog>) {
		this._timeLog = Object.assign({}, value);
		this.mode = this._timeLog && this._timeLog.id ? 'update' : 'create';
	}

	constructor(
		private timesheetService: TimesheetService,
		private toastrService: ToastrService,
		private ngxPermissionsService: NgxPermissionsService,
		private store: Store,
		private employeesService: EmployeesService,
		private dialogRef: NbDialogRef<EditTimeLogModalComponent>
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
		this.loadEmployees$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(async () => {
				if (
					this.changeSelectedEmployee &&
					this.selectedRange &&
					this.selectedRange.start
				) {
					const {
						items = []
					} = await this.employeesService.getWorking(
						this.organization.id,
						this.organization.tenantId,
						this.selectedRange.start,
						true
					);
					this.employees = items;
				}
			});

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
					this.loadEmployees$.next();
					return value;
				})
			)
		)
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				if (
					this.selectedRange &&
					this.selectedRange.start &&
					this.selectedRange.end
				) {
					this.loadEmployees$.next();
					this.checkOverlaps();
				}
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				this.organization = organization;
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
		const employeeId = this.form.get('employeeId').value;
		if (this.selectedRange && employeeId) {
			const startDate = toUTC(this.selectedRange.start).toISOString();
			const endDate = toUTC(this.selectedRange.end).toISOString();
			const request: IGetTimeLogConflictInput = {
				...(this.timeLog.id ? { ignoreId: [this.timeLog.id] } : {}),
				startDate,
				endDate,
				employeeId: employeeId,
				relations: ['project', 'task']
			};
			this.timesheetService.checkOverlaps(request).then((timeLogs) => {
				this.overlaps = timeLogs.map((timeLog) => {
					const timeLogStartedAt = toLocal(timeLog.startedAt);
					const timeLogStoppedAt = toLocal(timeLog.stoppedAt);
					let overlapDueration = 0;
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
							overlapDueration = moment(timeLogStoppedAt).diff(
								moment(timeLogStartedAt),
								'seconds'
							);
						} else {
							overlapDueration = moment(endDate).diff(
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
							overlapDueration = moment(timeLogStoppedAt).diff(
								moment(startDate),
								'seconds'
							);
						} else {
							overlapDueration = moment(endDate).diff(
								moment(startDate),
								'seconds'
							);
						}
					}
					timeLog.overlapDueration = overlapDueration;
					return timeLog;
				});
			});
		}
	}

	addTime() {
		if (!this.form.valid) {
			return;
		}
		const startedAt = toUTC(this.selectedRange.start).toDate();
		const stoppedAt = toUTC(this.selectedRange.end).toDate();

		const requestData = {
			..._.omit(this.form.value, ['selectedRange']),
			startedAt,
			stoppedAt,
			organizationId: this.organization.id
		};
		if (!requestData.employeeId) {
			requestData.employeeId = this.store.user.employeeId;
		}
		this.loading = true;
		let request;
		if (this.mode === 'create') {
			request = this.timesheetService.addTime(requestData);
		} else {
			request = this.timesheetService.updateTime(
				this.timeLog.id,
				requestData
			);
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

	ngOnDestroy(): void {}
}
