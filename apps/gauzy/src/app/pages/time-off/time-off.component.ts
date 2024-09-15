import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { debounceTime, filter, first, tap, finalize } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	ServerDataSource,
	Store,
	TimeOffService,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	StatusTypesEnum,
	ITimeOff,
	ComponentLayoutStyleEnum,
	IOrganization,
	IDateRangePicker,
	ID,
	PermissionsEnum,
	NullableString
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange, toUTC } from '@gauzy/ui-core/common';
import {
	PaginationFilterBaseComponent,
	IPaginationBase,
	PictureNameTagsComponent,
	DateViewComponent,
	DeleteConfirmationComponent,
	getAdjustDateRangeFutureAllowed,
	TimeOffRequestMutationComponent,
	TimeOffHolidayMutationComponent,
	InputFilterComponent,
	StatusBadgeComponent
} from '@gauzy/ui-core/shared';
import { ApprovalPolicyComponent } from '../approvals/table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-off-list',
	templateUrl: './time-off.component.html',
	styleUrls: ['./time-off.component.scss']
})
export class TimeOffComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public settingsSmartTable: object;
	public selectedEmployeeId: ID;
	public selectedDateRange: IDateRangePicker;
	public sourceSmartTable: ServerDataSource;
	public timeOffs: ITimeOff[] = [];
	public selectedTimeOffRecord: ITimeOff;
	public timeOffRequest: ITimeOff;
	public PermissionsEnum = PermissionsEnum;
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public timeOffStatuses = Object.keys(StatusTypesEnum);
	public loading: boolean;
	public disableButton: boolean = true;
	public displayHolidays: boolean = true;
	public showActions: boolean = false;
	public includeArchived: boolean = false;
	public showFilter: boolean = false;
	public organization: IOrganization;
	public timeOff$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _dialogService: NbDialogService,
		private readonly _timeOffService: TimeOffService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _httpClient: HttpClient,
		private readonly _route: ActivatedRoute,
		private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.timeOff$
			.pipe(
				debounceTime(300),
				tap(() => this.getTimeOffs()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.timeOff$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this._store.selectedOrganization$;
		const selectedDateRange$ = this._dateRangePickerBuilderService.selectedDateRange$;
		const storeEmployee$ = this._store.selectedEmployee$;
		combineLatest([storeOrganization$, selectedDateRange$, storeEmployee$])
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange, employee]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.timeOff$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.requestDaysOff()),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.timeOffs = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF;
		this._store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.timeOffs = [])),
				tap(() => this.timeOff$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Change display holidays
	 *
	 * @param isHoliday
	 */
	changeDisplayHolidays(isHoliday: boolean) {
		this._refresh$.next(true);
		this.timeOff$.next(true);
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * On status change filter
	 *
	 * @param status
	 */
	detectStatusChange(status: StatusTypesEnum) {
		switch (status) {
			case StatusTypesEnum.REQUESTED:
			case StatusTypesEnum.APPROVED:
			case StatusTypesEnum.DENIED:
				this.setFilter({ field: 'status', search: status });
				break;
			default:
				this.setFilter({ field: 'status', search: '' });
				break;
		}
	}

	/**
	 * Select time off record
	 *
	 * @param param0
	 */
	selectTimeOff({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedTimeOffRecord = isSelected ? data : null;
	}

	/**
	 * Approves the selected time off request.
	 *
	 * @param selectedItem
	 */
	approveDaysOff(selectedItem?: ITimeOff) {
		if (selectedItem) {
			this.selectTimeOff({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedTimeOffRecord.status !== StatusTypesEnum.APPROVED) {
			const requestId = this.selectedTimeOffRecord.id;
			this.selectedTimeOffRecord.status = StatusTypesEnum.APPROVED;
			this._timeOffService
				.updateRequestStatus(requestId, 'approval')
				.pipe(untilDestroyed(this), first())
				.subscribe({
					next: () => {
						this._toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.STATUS_SET_APPROVED');
						this._refresh$.next(true);
						this.timeOff$.next(true);
					},
					error: () => this._toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS')
				});
		} else {
			this._toastrService.success(
				'TIME_OFF_PAGE.NOTIFICATIONS.APPROVED_NO_CHANGES',
				'TIME_OFF_PAGE.NOTIFICATIONS.NO_CHANGES'
			);
			this._refresh$.next(true);
			this.timeOff$.next(true);
		}
	}

	/**
	 * Denies the selected time off request.
	 *
	 * @param selectedItem
	 */
	denyDaysOff(selectedItem?: ITimeOff) {
		if (selectedItem) {
			this.selectTimeOff({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedTimeOffRecord.status !== StatusTypesEnum.DENIED) {
			const requestId = this.selectedTimeOffRecord.id;
			this.selectedTimeOffRecord.status = StatusTypesEnum.DENIED;
			this._timeOffService
				.updateRequestStatus(requestId, 'denied')
				.pipe(untilDestroyed(this), first())
				.subscribe({
					next: () => {
						this._toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DENIED');
						this.timeOff$.next(true);
					},
					error: () => this._toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS')
				});
		} else {
			this._toastrService.success(
				'TIME_OFF_PAGE.NOTIFICATIONS.DENIED_NO_CHANGES',
				'TIME_OFF_PAGE.NOTIFICATIONS.NO_CHANGES'
			);
			this._refresh$.next(true);
			this.timeOff$.next(true);
		}
	}

	/**
	 * Deletes the selected time off request.
	 *
	 * @param selectedItem
	 */
	deleteRequest(selectedItem?: ITimeOff) {
		if (selectedItem) {
			this.selectTimeOff({
				isSelected: true,
				data: selectedItem
			});
		}
		this._dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('TIME_OFF_PAGE.TIME_OFF_REQUEST')
				}
			})
			.onClose.pipe(first())
			.subscribe((res) => {
				if (res) {
					this._timeOffService
						.deleteDaysOffRequest(this.selectedTimeOffRecord.id)
						.pipe(untilDestroyed(this), first())
						.subscribe({
							next: () => {
								this._toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DELETED');
								this._refresh$.next(true);
								this.timeOff$.next(true);
							},
							error: () => this._toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_DELETE_REQUEST')
						});
				}
			});
	}

	/**
	 * Opens a dialog for requesting time off.
	 */
	requestDaysOff() {
		this._dialogService
			.open(TimeOffRequestMutationComponent, {
				context: { type: 'request' }
			})
			.onClose.pipe(untilDestroyed(this), first())
			.subscribe((res) => {
				this.timeOffRequest = res;
				this._createRecord();
			});
	}

	/**
	 * Adds holidays to the selected time off request.
	 * Opens a dialog for adding holidays.
	 */
	addHolidays() {
		this._dialogService
			.open(TimeOffHolidayMutationComponent)
			.onClose.pipe(untilDestroyed(this), first())
			.subscribe((res) => {
				if (res) {
					this.timeOffRequest = res;
					this._createRecord();
				}
			});
	}

	private get _isGridLayout(): boolean {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
	}

	updateTimeOffRecord() {
		this._removeDocUrl();

		this._dialogService
			.open(TimeOffRequestMutationComponent, {
				context: { timeOff: this.selectedTimeOffRecord }
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

	/**
	 * Archives the selected time off request.
	 */
	archive() {
		const requestId = this.selectedTimeOffRecord.id;
		this.selectedTimeOffRecord.isArchived = true;
		this.timeOffRequest = this.selectedTimeOffRecord;
		this._updateRecord(requestId);
	}

	/**
	 * Change include archived
	 *
	 * @param $event
	 */
	changeIncludeArchived($event) {
		this._refresh$.next(true);
		this.timeOff$.next(true);
	}

	/**
	 * Load smart table settings configuration
	 *
	 */
	private _loadSmartTableSettings() {
		// Get pagination settings
		const pagination: IPaginationBase = this.getPagination();

		// Set up smart table settings
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.TIME_OFF'),
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					type: 'custom',
					class: 'align-row',
					renderComponent: PictureNameTagsComponent,
					componentInitFunction: (instance: PictureNameTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					isFilterable: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({
							field: 'user.firstName',
							search: value
						});
					}
				},
				extendedDescription: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'),
					type: 'html',
					isFilterable: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'description', search: value });
					}
				},
				policy: {
					title: this.getTranslation('SM_TABLE.POLICY'),
					type: 'custom',
					renderComponent: ApprovalPolicyComponent,
					componentInitFunction: (instance: ApprovalPolicyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					},
					isFilterable: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'policy.name', search: value });
					}
				},
				start: {
					title: this.getTranslation('SM_TABLE.START'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				end: {
					title: this.getTranslation('SM_TABLE.END'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				requestDate: {
					title: this.getTranslation('SM_TABLE.REQUEST_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				statusBadge: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					isFilterable: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				}
			}
		};
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		this.loading = true;

		try {
			const { id: organizationId, tenantId } = this.organization;
			const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);

			this.sourceSmartTable = new ServerDataSource(this._httpClient, {
				endPoint: `${API_PREFIX}/time-off-request/pagination`,
				relations: ['policy', 'document', 'employees.user'],
				join: {
					alias: 'time_off_request',
					leftJoin: {
						policy: 'time_off_request.policy',
						employees: 'time_off_request.employees',
						user: 'employees.user'
					},
					...(this.filters.join ? this.filters.join : {})
				},
				where: {
					organizationId,
					tenantId,
					isHoliday: !this.displayHolidays,
					includeArchived: this.includeArchived,
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
					...(this.selectedEmployeeId ? { employeeIds: [this.selectedEmployeeId] } : {}),
					...(this.filters.where ? this.filters.where : {})
				},
				resultMap: (timeOff: ITimeOff) => {
					return Object.assign({}, timeOff, this.mapTimeOffRequest(timeOff));
				},
				finalize: () => {
					if (this._isGridLayout) this.timeOffs.push(...this.sourceSmartTable.getData());
					this.setPagination({
						...this.getPagination(),
						totalItems: this.sourceSmartTable.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			console.log('Error while retrieving time off requests: ', error);
			this._errorHandlingService.handleError(error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * GET time off requests
	 *
	 * @returns
	 */
	private async getTimeOffs() {
		if (!this.organization) {
			return;
		}
		try {
			// Set up the Smart Table source
			this.setSmartTableSource();

			// Get pagination settings
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the Smart Table source
			this.sourceSmartTable.setPaging(activePage, itemsPerPage, false);

			// Load additional data for grid layout, if active
			this._loadGridLayoutData();
		} catch (error) {
			this._toastrService.danger(error, 'TIME_OFF_PAGE.NOTIFICATIONS.ERR_LOAD_RECORDS');
		}
	}

	/**
	 * Mapped Time Off Requests
	 *
	 * @param timeOff
	 * @returns
	 */
	mapTimeOffRequest(timeOff: ITimeOff) {
		let employeeName: string;
		let employeeImage: string;
		let extendedDescription = '';

		if (timeOff.employees.length !== 1) {
			employeeName = this.getTranslation('TIME_OFF_PAGE.MULTIPLE_EMPLOYEES');
			employeeImage = 'assets/images/avatars/people-outline.svg';
		} else {
			employeeName = `${timeOff.employees[0].fullName}`;
			employeeImage = timeOff.employees[0].user.imageUrl;
		}
		if (timeOff.documentUrl) {
			extendedDescription = `<a href=${timeOff.documentUrl} target="_blank">${this.getTranslation(
				'TIME_OFF_PAGE.VIEW_REQUEST_DOCUMENT'
			)}</a><br>${timeOff.description}`;
		} else {
			extendedDescription = timeOff.description;
		}
		return {
			fullName: employeeName,
			imageUrl: employeeImage,
			extendedDescription: extendedDescription,
			statusBadge: this.statusMapper(timeOff.status)
		};
	}

	private async _loadGridLayoutData() {
		if (this._isGridLayout) await this.sourceSmartTable.getElements();
	}

	private _createRecord() {
		try {
			if (this.timeOffRequest) {
				this._timeOffService
					.createRequest(this.timeOffRequest)
					.pipe(
						untilDestroyed(this),
						first(),
						tap(() => this._toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.RECORD_CREATED')),
						tap(() =>
							this._dateRangePickerBuilderService.refreshDateRangePicker(
								moment(this.timeOffRequest.start)
							)
						),
						finalize(() => {
							this._refresh$.next(true);
							this.timeOff$.next(true);
						})
					)
					.subscribe();
			}
		} catch (error) {
			this._toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_CREATE_RECORD');
		}
	}

	private _updateRecord(id: ID) {
		try {
			this._timeOffService
				.updateRequest(id, this.timeOffRequest)
				.pipe(
					untilDestroyed(this),
					first(),
					tap(() => this._toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_UPDATED')),
					tap(() =>
						this._dateRangePickerBuilderService.refreshDateRangePicker(moment(this.timeOffRequest.start))
					),
					finalize(() => {
						this._refresh$.next(true);
						this.timeOff$.next(true);
					})
				)
				.subscribe();
		} catch (error) {
			this._toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_UPDATE_RECORD');
		}
	}

	private _removeDocUrl() {
		if (this.selectedTimeOffRecord.description) {
			const index = this.selectedTimeOffRecord.description.lastIndexOf('>');
			const nativeDescription = this.selectedTimeOffRecord.description;
			this.selectedTimeOffRecord.description = nativeDescription.substring(index + 1);
		}
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectTimeOff({ isSelected: false, data: null });
	}

	/**
	 * Navigate to employee edit section
	 *
	 * @param row
	 */
	navigateToEmployee(row: ITimeOff) {
		if (row?.employees.length > 0) {
			// Extract the first employee from the employees array
			const [employee] = row.employees;
			this._router.navigate([`/pages/employees/edit`, employee.id]);
		}
	}

	/**
	 * Maps a status string to its corresponding badge class and returns an object
	 * containing the original text and the computed class.
	 *
	 * @param {NullableString} value - The status string to map, which can be null or undefined.
	 * @returns {{ text: NullableString, class: string }} An object containing the status text
	 * and the associated badge class.
	 */
	private statusMapper(value: NullableString): { text: NullableString; class: string } {
		const badgeClass = value
			? {
					[StatusTypesEnum.APPROVED]: 'success',
					[StatusTypesEnum.REQUESTED]: 'warning'
			  }[value.toUpperCase()] || 'danger'
			: 'danger';

		return {
			text: value,
			class: badgeClass
		};
	}

	ngOnDestroy(): void {}
}
