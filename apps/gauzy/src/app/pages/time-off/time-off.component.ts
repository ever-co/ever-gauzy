import { Component, OnInit, OnDestroy } from '@angular/core';
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
	selectedStatus = 'All';
	timeOffStatuses = Object.keys(StatusTypesEnum);
	loading = false;
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
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				end: {
					title: 'End',
					type: 'date',
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				requestDate: {
					title: 'Request Date',
					type: 'date',
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
					employeeId: this.selectedEmployeeId || null
				},
				this.selectedDate || null
			)
			.pipe(first())
			.subscribe((res) => {
				this.sourceSmartTable.load(res.items);
			});
	}

	openTimeOffSettings() {
		this.router.navigate(['/pages/employees/time-off/settings']);
	}

	selectRecord(event: Event) {
		console.log(event);
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
							`Time off record ${this.timeOffRequest.description} successfully created!`,
							'Success'
						);
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
	}

	ngOnDestroy(): void {}
}
