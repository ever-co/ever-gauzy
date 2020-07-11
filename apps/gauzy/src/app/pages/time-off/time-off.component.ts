import { Component, OnInit, OnDestroy, ɵConsole } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { StatusTypesEnum, PermissionsEnum, TimeOff } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { Router } from '@angular/router';
import { TimeOffRequestMutationComponent } from '../../@shared/time-off/time-off-request-mutation/time-off-request-mutation.component';
import { TimeOffService } from '../../@core/services/time-off.service';
import { LocalDataSource } from 'ng2-smart-table';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { DatePipe } from '@angular/common';

@Component({
	selector: 'ngx-time-off',
	templateUrl: './time-off.component.html',
	styleUrls: ['./time-off.component.scss']
})
export class TimeOffComponent implements OnInit, OnDestroy {
	constructor(
		private router: Router,
		private dialogService: NbDialogService,
		private timeOffService: TimeOffService,
		private toastrService: NbToastrService,
		private store: Store
	) {}

	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();

	private _selectedOrganizationId: string;
	timeOffRequest: TimeOff;
	selectedDate: Date;
	selectedEmployeeId: string;
	selectedStatus = 'ALL';
	selectedTimeOffRecord: TimeOff;
	tableData = [];
	timeOffStatuses = Object.keys(StatusTypesEnum);
	loading = false;
	isRecordSelected = false;
	displayHolidays = true;
	hasEditPermission = false;

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.POLICY_EDIT
				);
			});

		this.store.selectedDate$
			.pipe(untilDestroyed(this))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployeeId) {
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this._loadTableData(this._selectedOrganizationId);
					}
				}
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadTableData(this._selectedOrganizationId);
					}
				}
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					if (this.loading) {
						this._loadTableData(this._selectedOrganizationId);
					}
				}
			});

		this._loadSmartTableSettings();
		this._loadTableData();
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: 'Employee',
					type: 'custom',
					renderComponent: PictureNameTagsComponent,
					class: 'align-row'
				},
				description: {
					title: 'Description',
					type: 'string',
					class: 'text-center'
				},
				policy: {
					title: 'Policy',
					type: 'string',
					class: 'text-center'
				},
				start: {
					title: 'Start',
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				end: {
					title: 'End',
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				requestDate: {
					title: 'Request Date',
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				status: {
					title: 'Status',
					type: 'string',
					class: 'text-center'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	private _loadTableData(orgId?: string) {
		this.timeOffService
			.getAllTimeOffRecords(
				['employees', 'employees.user', 'policy'],
				{
					organizationId: orgId,
					employeeId: this.selectedEmployeeId || ''
				},
				this.selectedDate || null
			)
			.pipe(first())
			.subscribe(
				(res) => {
					this.tableData = [];

					res.items.forEach((result: TimeOff) => {
						let employeeName: string;
						let employeeImage: string;

						if (result.employees.length !== 1) {
							employeeName = 'Multiple employees';
							employeeImage =
								'assets/images/avatars/people-outline.svg';
						} else {
							employeeName = `${result.employees[0].user.firstName} ${result.employees[0].user.lastName}`;
							employeeImage = result.employees[0]?.user?.imageUrl;
						}

						this.tableData.push({
							...result,
							fullName: employeeName,
							imageUrl: employeeImage,
							policy: result.policy.name
						});
					});

					this.sourceSmartTable.load(this.tableData);
				},
				() =>
					this.toastrService.danger('Unable to load time off records')
			);
	}

	detectStatusChange(status: string) {
		let filteredData: TimeOff[];

		switch (status) {
			case 'REQUESTED':
				filteredData = [...this.tableData].filter(
					(record: TimeOff) => record.status === 'Requested'
				);
				this.isRecordSelected = false;
				this.sourceSmartTable.load(filteredData);
				break;
			case 'APPROVED':
				filteredData = [...this.tableData].filter(
					(record: TimeOff) => record.status === 'Approved'
				);
				this.isRecordSelected = false;
				this.sourceSmartTable.load(filteredData);
				break;
			case 'DENIED':
				filteredData = [...this.tableData].filter(
					(record: TimeOff) => record.status === 'Denied'
				);
				this.isRecordSelected = false;
				this.sourceSmartTable.load(filteredData);
				break;
			default:
				this.isRecordSelected = false;
				this.sourceSmartTable.load(this.tableData);
				break;
		}
	}

	openTimeOffSettings() {
		this.router.navigate(['/pages/employees/time-off/settings']);
	}

	selectRecord(selectedRow) {
		this.isRecordSelected = true;

		this.selectedTimeOffRecord = selectedRow.data;
	}

	approveDaysOff() {
		if (this.selectedTimeOffRecord.status !== 'Approved') {
			const requestId = this.selectedTimeOffRecord.id;
			this.selectedTimeOffRecord.status = 'Approved';
			this.timeOffService
				.updateRequestStatus(requestId, {
					status: this.selectedTimeOffRecord.status
				})
				.pipe(first())
				.subscribe(
					() => {
						this.toastrService.success(
							'You successfully set the days off request status to approved',
							'Days off request approved'
						);
						this._loadTableData();
					},
					() =>
						this.toastrService.danger(
							'Unable to set days off request status.'
						)
				);
		} else {
			this.toastrService.info(
				'The days off request status is already set to approved',
				'No changes'
			);
		}
	}

	denyDaysOff() {
		if (this.selectedTimeOffRecord.status !== 'Denied') {
			const requestId = this.selectedTimeOffRecord.id;
			this.selectedTimeOffRecord.status = 'Denied';
			this.timeOffService
				.updateRequestStatus(requestId, {
					status: this.selectedTimeOffRecord.status
				})
				.pipe(first())
				.subscribe(
					() => {
						this.toastrService.success(
							'You successfully set the days off request status to denied',
							'Days off request denied'
						);
						this._loadTableData();
					},
					() =>
						this.toastrService.danger(
							'Unable to set days off request status.'
						)
				);
		} else {
			this.toastrService.info(
				'The days off request status is already set to denied',
				'No changes'
			);
		}
	}

	deleteRequest() {
		this.timeOffService
			.deleteDaysOffRequest(this.selectedTimeOffRecord.id)
			.pipe(first())
			.subscribe(
				() => {
					this.toastrService.success(
						'Days off request successfully deleted',
						'Days off record deleted'
					);
					this._loadTableData();
				},
				() =>
					this.toastrService.warning(
						'Unable to delete Days off request'
					)
			);
	}

	requestDaysOff() {
		this.dialogService
			.open(TimeOffRequestMutationComponent, {
				context: { type: 'request' }
			})
			.onClose.pipe(first())
			.subscribe((res) => {
				this.timeOffRequest = res;
				this._createRecord();
			});
	}

	addHolidays() {
		this.dialogService
			.open(TimeOffRequestMutationComponent, {
				context: { type: 'holiday' }
			})
			.onClose.pipe(first())
			.subscribe((res) => {
				this.timeOffRequest = res;
				this._createRecord();
			});
	}

	private _createRecord() {
		if (this.timeOffRequest) {
			this.timeOffService
				.createRequest(this.timeOffRequest)
				.pipe(first())
				.subscribe(
					() => {
						this.toastrService.success(
							`Time off record ${this.timeOffRequest.description} successfully created!`
						);
						this._loadTableData();
					},
					() =>
						this.toastrService.danger(
							'Unable to create Time off record'
						)
				);
		}
	}

	changeDisplayHolidays(checked: boolean) {
		this.displayHolidays = checked;
		this.isRecordSelected = false;

		if (this.displayHolidays) {
			this.sourceSmartTable.load(this.tableData);
		} else {
			const filteredData = [...this.tableData].filter(
				(record: TimeOff) => !record.isHoliday
			);
			this.sourceSmartTable.load(filteredData);
		}
	}

	ngOnDestroy(): void {}
}
