import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import {
	StatusTypesEnum,
	PermissionsEnum,
	TimeOff,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { first, takeUntil } from 'rxjs/operators';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { TimeOffRequestMutationComponent } from '../../@shared/time-off/time-off-request-mutation/time-off-request-mutation.component';
import { TimeOffService } from '../../@core/services/time-off.service';
import { LocalDataSource } from 'ng2-smart-table';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { DatePipe } from '@angular/common';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { TimeOffStatusComponent } from './table-components/time-off-status.component';
import { ToastrService } from '../../@core/services/toastr.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { Subject } from 'rxjs/internal/Subject';

@Component({
	selector: 'ngx-time-off',
	templateUrl: './time-off.component.html',
	styleUrls: ['./time-off.component.scss']
})
export class TimeOffComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	timeOffData: TimeOff[];
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
	private _ngDestroy$ = new Subject<void>();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	@ViewChild('timeOffTable') timeOffTable;

	constructor(
		private router: Router,
		private dialogService: NbDialogService,
		private timeOffService: TimeOffService,
		private toastrService: ToastrService,
		private store: Store,
		private translate: TranslateService
	) {
		super(translate);
		this.setView();
	}

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

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});

		this._loadSmartTableSettings();
		this._loadTableData();
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent,
					class: 'align-row'
				},
				description: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'),
					type: 'string',
					class: 'text-center'
				},
				policy: {
					title: this.getTranslation('SM_TABLE.POLICY'),
					type: 'string',
					class: 'text-center'
				},
				start: {
					title: this.getTranslation('SM_TABLE.START'),
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				end: {
					title: this.getTranslation('SM_TABLE.END'),
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				requestDate: {
					title: this.getTranslation('SM_TABLE.REQUEST_DATE'),
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					renderComponent: TimeOffStatusComponent,
					filter: false
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
							employeeImage = result.employees[0].user.imageUrl;
						}

						this.tableData.push({
							...result,
							fullName: employeeName,
							imageUrl: employeeImage,
							policy: result.policy.name
						});
					});
					this.timeOffData = this.tableData;
					this.sourceSmartTable.load(this.tableData);
				},
				() =>
					this.toastrService.danger(
						'TIME_OFF_PAGE.NOTIFICATIONS.ERR_LOAD_RECORDS'
					)
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
				this.timeOffData = filteredData;
				this.sourceSmartTable.load(filteredData);
				break;
			case 'APPROVED':
				filteredData = [...this.tableData].filter(
					(record: TimeOff) => record.status === 'Approved'
				);
				this.isRecordSelected = false;
				this.timeOffData = filteredData;
				this.sourceSmartTable.load(filteredData);
				break;
			case 'DENIED':
				filteredData = [...this.tableData].filter(
					(record: TimeOff) => record.status === 'Denied'
				);
				this.isRecordSelected = false;
				this.timeOffData = filteredData;
				this.sourceSmartTable.load(filteredData);
				break;
			default:
				this.isRecordSelected = false;
				this.timeOffData = this.tableData;
				this.sourceSmartTable.load(this.tableData);
				break;
		}
	}

	openTimeOffSettings() {
		this.router.navigate(['/pages/employees/time-off/settings']);
	}

	selectRecord({ isSelected, data }) {
		const selectedTimeOffRecord = isSelected ? data : null;
		if (this.timeOffTable) {
			this.timeOffTable.grid.dataSet.willSelect = false;
		}
		this.isRecordSelected = true;
		this.selectedTimeOffRecord = selectedTimeOffRecord;
	}

	approveDaysOff(selectedItem?: TimeOff) {
		if (selectedItem) {
			this.selectRecord({
				isSelected: true,
				data: selectedItem
			});
		}
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
							'TIME_OFF_PAGE.NOTIFICATIONS.STATUS_SET_APPROVED'
						);
						this._loadTableData();
					},
					() =>
						this.toastrService.danger(
							'TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS'
						)
				);
		} else {
			this.toastrService.success(
				'TIME_OFF_PAGE.NOTIFICATIONS.APPROVED_NO_CHANGES',
				'TIME_OFF_PAGE.NOTIFICATIONS.NO_CHANGES'
			);
		}
	}

	denyDaysOff(selectedItem?: TimeOff) {
		if (selectedItem) {
			this.selectRecord({
				isSelected: true,
				data: selectedItem
			});
		}
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
							'TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DENIED'
						);
						this._loadTableData();
					},
					() =>
						this.toastrService.danger(
							'TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS'
						)
				);
		} else {
			this.toastrService.success(
				'TIME_OFF_PAGE.NOTIFICATIONS.DENIED_NO_CHANGES',
				'TIME_OFF_PAGE.NOTIFICATIONS.NO_CHANGES'
			);
		}
	}

	deleteRequest(selectedItem?: TimeOff) {
		if (selectedItem) {
			this.selectRecord({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: { recordType: 'Time off request' }
			})
			.onClose.pipe(first())
			.subscribe((result) => {
				if (result) {
					this.timeOffService
						.deleteDaysOffRequest(this.selectedTimeOffRecord.id)
						.pipe(first())
						.subscribe(
							() => {
								this.toastrService.success(
									'TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DELETED'
								);
								this._loadTableData();
							},
							() =>
								this.toastrService.danger(
									'TIME_OFF_PAGE.NOTIFICATIONS.ERR_DELETE_REQUEST'
								)
						);
				}
			});
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
							'TIME_OFF_PAGE.NOTIFICATIONS.RECORD_CREATED'
						);
						this._loadTableData();
					},
					() =>
						this.toastrService.danger(
							'TIME_OFF_PAGE.NOTIFICATIONS.ERR_CREATE_RECORD'
						)
				);
		}
	}

	changeDisplayHolidays(checked: boolean) {
		this.displayHolidays = checked;
		this.isRecordSelected = false;

		if (this.displayHolidays) {
			this.timeOffData = this.tableData;
			this.sourceSmartTable.load(this.tableData);
		} else {
			const filteredData = [...this.tableData].filter(
				(record: TimeOff) => !record.isHoliday
			);
			this.timeOffData = filteredData;
			this.sourceSmartTable.load(filteredData);
		}
	}

	_applyTranslationOnSmartTable() {
		this.translate.onLangChange.subscribe(() => {
			this._loadSmartTableSettings();
		});
	}

	ngOnDestroy(): void {}
}
