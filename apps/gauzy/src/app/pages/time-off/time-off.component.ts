import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import {
	StatusTypesEnum,
	ITimeOff,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { filter, first, tap } from 'rxjs/operators';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { TimeOffRequestMutationComponent } from '../../@shared/time-off/time-off-request-mutation/time-off-request-mutation.component';
import { TimeOffService } from '../../@core/services/time-off.service';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { DatePipe } from '@angular/common';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ToastrService } from '../../@core/services/toastr.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-time-off',
	templateUrl: './time-off.component.html',
	styleUrls: ['./time-off.component.scss']
})
export class TimeOffComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	timeOffData: ITimeOff[];
	selectedTimeOffRecord: ITimeOff;
	timeOffRequest: ITimeOff;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedDate: Date;
	tableData = [];
	selectedEmployeeId: string;
	selectedStatus = 'ALL';
	timeOffStatuses = Object.keys(StatusTypesEnum);
	loading = false;
	isRecordSelected = false;
	displayHolidays = true;
	showActions = false;
	private _selectedOrganizationId: string;
	organization: IOrganization;
	includeArchived = false;
	showFilter = false;

	timeOffTable: Ng2SmartTableComponent;
	@ViewChild('timeOffTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.timeOffTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private router: Router,
		private dialogService: NbDialogService,
		private timeOffService: TimeOffService,
		private toastrService: ToastrService,
		private store: Store,
		private translate: TranslateService,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {
		super(translate);
		this.setView();
	}

	ngOnInit() {
		this.store.selectedDate$
			.pipe(untilDestroyed(this))
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedEmployeeId) {
					this._loadTableData(this._selectedOrganizationId);
				} else {
					if (this._selectedOrganizationId) {
						this._loadTableData(this._selectedOrganizationId);
					}
				}
			});
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this.isRecordSelected = false;
					this._loadTableData(this._selectedOrganizationId);
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadTableData(this._selectedOrganizationId);
					}
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				if (org) {
					this.organization = org;
					this._selectedOrganizationId = org.id;
					this._loadTableData(this._selectedOrganizationId);
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this._loadSmartTableSettings();
		this.applyTranslationOnSmartTable();
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.timeOffTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	showAdditionalActions() {
		this.showActions = !this.showActions;
	}

	changeDisplayHolidays(checked: boolean) {
		this.displayHolidays = checked;
		this.isRecordSelected = false;

		if (this.displayHolidays) {
			this.timeOffData = this.tableData;
			this.sourceSmartTable.load(this.tableData);
		} else {
			const filteredData = [...this.tableData].filter(
				(record: ITimeOff) => !record.isHoliday
			);
			this.timeOffData = filteredData;
			this.sourceSmartTable.load(filteredData);
		}
	}

	applyTranslationOnSmartTable() {
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this._loadSmartTableSettings();
		});
	}

	detectStatusChange(status: string) {
		let filteredData: ITimeOff[];

		switch (status) {
			case 'REQUESTED':
				filteredData = [...this.tableData].filter(
					(record: ITimeOff) => record.status === 'Requested'
				);
				this.isRecordSelected = false;
				this.timeOffData = filteredData;
				this.sourceSmartTable.load(filteredData);
				break;
			case 'APPROVED':
				filteredData = [...this.tableData].filter(
					(record: ITimeOff) => record.status === 'Approved'
				);
				this.isRecordSelected = false;
				this.timeOffData = filteredData;
				this.sourceSmartTable.load(filteredData);
				break;
			case 'DENIED':
				filteredData = [...this.tableData].filter(
					(record: ITimeOff) => record.status === 'Denied'
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
		this.isRecordSelected = isSelected ? true : false;
		this.selectedTimeOffRecord = isSelected ? data : null;
	}

	approveDaysOff(selectedItem?: ITimeOff) {
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
				.pipe(untilDestroyed(this), first())
				.subscribe(
					() => {
						this.toastrService.success(
							'TIME_OFF_PAGE.NOTIFICATIONS.STATUS_SET_APPROVED'
						);
						this._loadTableData(this._selectedOrganizationId);
						this.clearItem();
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
			this._loadTableData(this._selectedOrganizationId);
		}
	}

	denyDaysOff(selectedItem?: ITimeOff) {
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
				.pipe(untilDestroyed(this), first())
				.subscribe(
					() => {
						this.toastrService.success(
							'TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DENIED'
						);
						this._loadTableData(this._selectedOrganizationId);
						this.clearItem();
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

	deleteRequest(selectedItem?: ITimeOff) {
		if (selectedItem) {
			this.selectRecord({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'TIME_OFF_PAGE.TIME_OFF_REQUEST'
					)
				}
			})
			.onClose.pipe(first())
			.subscribe((res) => {
				if (res) {
					this.timeOffService
						.deleteDaysOffRequest(this.selectedTimeOffRecord.id)
						.pipe(untilDestroyed(this), first())
						.subscribe(
							() => {
								this.toastrService.success(
									'TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DELETED'
								);
								this._loadTableData(
									this._selectedOrganizationId
								);
								this.clearItem();
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
			.onClose.pipe(untilDestroyed(this), first())
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
			.onClose.pipe(untilDestroyed(this), first())
			.subscribe((res) => {
				if (res) {
					this.timeOffRequest = res;
					this._createRecord();
				}
			});
	}

	updateTimeOffRecord() {
		this._removeDocUrl();

		this.dialogService
			.open(TimeOffRequestMutationComponent, {
				context: { type: this.selectedTimeOffRecord }
			})
			.onClose.pipe(untilDestroyed(this), first())
			.subscribe((res) => {
				if (res) {
					const requestId = this.selectedTimeOffRecord.id;
					this.timeOffRequest = res;
					this._updateRecord(requestId);
				}
			});
	}

	archive() {
		const requestId = this.selectedTimeOffRecord.id;
		this.selectedTimeOffRecord.isArchived = true;
		this.timeOffRequest = this.selectedTimeOffRecord;
		this._updateRecord(requestId);
	}

	changeIncludeArchived($event) {
		this.includeArchived = $event;
		this._loadTableData(this._selectedOrganizationId);
	}

	showHideFilter() {
		this.showFilter = !this.showFilter;
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
					type: 'html'
				},
				policyName: {
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
					renderComponent: StatusBadgeComponent,
					filter: false,
					valuePrepareFunction: (cell, row) => {
						let badgeClass;
						if (cell) {
							badgeClass = ['approved'].includes(
								cell.toLowerCase()
							)
								? 'success'
								: ['requested'].includes(cell.toLowerCase())
								? 'warning'
								: 'danger';
						}
						return {
							text: cell,
							class: badgeClass
						};
					}
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	private _loadTableData(orgId?: string) {
		this.loading = true;
		const { tenantId } = this.store.user;
		this.timeOffService
			.getAllTimeOffRecords(
				[],
				{
					organizationId: orgId,
					tenantId,
					employeeId: this.selectedEmployeeId || null
				},
				this.selectedDate || null
			)
			.pipe(untilDestroyed(this), first())
			.subscribe(
				(res) => {
					this.tableData = [];
					res.items.forEach((result: ITimeOff) => {
						let employeeName: string;
						let employeeImage: string;
						let extendedDescription = '';

						if (result.employees.length !== 1) {
							employeeName = this.getTranslation(
								'TIME_OFF_PAGE.MULTIPLE_EMPLOYEES'
							);
							employeeImage =
								'assets/images/avatars/people-outline.svg';
						} else {
							employeeName = `${result.employees[0].user.firstName} ${result.employees[0].user.lastName}`;
							employeeImage = result.employees[0].user.imageUrl;
						}

						if (result.documentUrl) {
							extendedDescription = `<a href=${
								result.documentUrl
							} target="_blank">${this.getTranslation(
								'TIME_OFF_PAGE.VIEW_REQUEST_DOCUMENT'
							)}</a><br>${result.description}`;
						} else {
							extendedDescription = result.description;
						}

						if (!result.isArchived || this.includeArchived) {
							this.tableData.push({
								...result,
								fullName: employeeName,
								imageUrl: employeeImage,
								policyName: result.policy.name,
								description: extendedDescription
							});
						}
					});
					this.timeOffData = this.tableData;
					this.sourceSmartTable.load(this.tableData);
				},
				() =>
					this.toastrService.danger(
						'TIME_OFF_PAGE.NOTIFICATIONS.ERR_LOAD_RECORDS'
					)
			);
		this.loading = false;
	}

	private _createRecord() {
		if (this.timeOffRequest) {
			this.timeOffService
				.createRequest(this.timeOffRequest)
				.pipe(untilDestroyed(this), first())
				.subscribe(
					() => {
						this.toastrService.success(
							'TIME_OFF_PAGE.NOTIFICATIONS.RECORD_CREATED'
						);
						this._loadTableData(this._selectedOrganizationId);
						this.clearItem();
					},
					() =>
						this.toastrService.danger(
							'TIME_OFF_PAGE.NOTIFICATIONS.ERR_CREATE_RECORD'
						)
				);
		}
	}

	private _updateRecord(id: string) {
		this.timeOffService
			.updateRequest(id, this.timeOffRequest)
			.pipe(untilDestroyed(this), first())
			.subscribe(
				() => {
					this.toastrService.success(
						'TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_UPDATED'
					);
					this._loadTableData(this._selectedOrganizationId);
					this.clearItem();
				},
				() =>
					this.toastrService.danger(
						'TIME_OFF_PAGE.NOTIFICATIONS.ERR_UPDATE_RECORD'
					)
			);
	}

	private _removeDocUrl() {
		const index = this.selectedTimeOffRecord.description.lastIndexOf('>');
		const nativeDescription = this.selectedTimeOffRecord.description;
		this.selectedTimeOffRecord.description = nativeDescription.substr(
			index + 1
		);
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectRecord({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.timeOffTable && this.timeOffTable.grid) {
			this.timeOffTable.grid.dataSet['willSelect'] = 'false';
			this.timeOffTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy(): void {}
}
