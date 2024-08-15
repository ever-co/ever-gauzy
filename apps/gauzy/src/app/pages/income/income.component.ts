import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, Subject } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import moment from 'moment';
import {
	IIncome,
	ComponentLayoutStyleEnum,
	IOrganization,
	IEmployee,
	IOrganizationContact,
	ITag,
	IDateRangePicker,
	PermissionsEnum
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange, employeeMapper, toUTC } from '@gauzy/ui-core/common';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	IncomeService,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	ALL_EMPLOYEES_SELECTED,
	ContactLinksComponent,
	DateViewComponent,
	DeleteConfirmationComponent,
	EmployeeLinksComponent,
	IPaginationBase,
	IncomeExpenseAmountComponent,
	IncomeMutationComponent,
	InputFilterComponent,
	OrganizationContactFilterComponent,
	PaginationFilterBaseComponent,
	TagsColorFilterComponent,
	TagsOnlyComponent,
	getAdjustDateRangeFutureAllowed
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './income.component.html',
	styleUrls: ['./income.component.scss']
})
export class IncomeComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public smartTableSettings: object;
	public selectedEmployeeId: string;
	public selectedDateRange: IDateRangePicker;
	public smartTableSource: ServerDataSource;
	public disableButton: boolean = true;
	public loading: boolean = false;
	public viewComponentName: ComponentEnum;
	public incomes: IIncome[] = [];
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public selectedIncome: IIncome;

	public organization: IOrganization;
	public incomes$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true }) actionButtons: TemplateRef<any>;

	constructor(
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly incomeService: IncomeService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		private readonly errorHandler: ErrorHandlingService,
		public readonly translateService: TranslateService,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();

		// Combine three observables into one observable using combineLatest
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const storeEmployee$ = this.store.selectedEmployee$;

		// Subscribe to the incomes$ observable
		this.incomes$
			.pipe(
				// Debounce incoming data to wait for 300 milliseconds of inactivity before processing
				debounceTime(300),
				// Execute the _clearItem method
				tap(() => this._clearItem()),
				// Execute the getIncomes method
				tap(() => this.getIncomes()),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the pagination$ observable
		this.pagination$
			.pipe(
				// Debounce incoming changes to wait for 100 milliseconds of inactivity before processing
				debounceTime(100),
				// Only emit distinct consecutive changes
				distinctUntilChange(),
				// Execute the incomes$.next(true) method
				tap(() => this.incomes$.next(true)),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Combine three observables into one observable using combineLatest
		combineLatest([storeOrganization$, storeDateRange$, storeEmployee$])
			.pipe(
				// Debounce incoming changes to wait for 300 milliseconds of inactivity before processing
				debounceTime(300),
				// Only emit distinct consecutive changes in the combined values
				distinctUntilChange(),
				// Filter out invalid combinations where either organization or dateRange is not available
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				// Tap into the combined values and perform actions
				tap(([organization, dateRange, employee]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				// Trigger a refresh when changes are detected
				tap(() => this._refresh$.next(true)),
				// Trigger an update of incomes when changes are detected
				tap(() => this.incomes$.next(true)),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the query parameters
		this.route.queryParamMap
			.pipe(
				// Filter out unwanted changes and only proceed if 'openAddDialog' is 'true'
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				// Debounce the changes to avoid rapid triggering
				debounceTime(1000),
				// Execute the addIncome method when conditions are met
				tap(() => this.addIncome()),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the _refresh$ observable
		this._refresh$
			.pipe(
				// Filter out unwanted refreshes when the data layout style is not 'CARDS_GRID'
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				// Execute the refreshPagination method
				tap(() => this.refreshPagination()),
				// Clear the incomes array
				tap(() => (this.incomes = [])),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		if (this.store.user && !this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// Remove the 'employee' column from smartTableSettings.columns
			delete this.smartTableSettings['columns']['employee'];

			// Clone the smartTableSettings object to trigger change detection
			this.smartTableSettings = { ...this.smartTableSettings };
		}
	}

	/**
	 * Sets the view based on the selected component layout style.
	 */
	setView() {
		this.viewComponentName = ComponentEnum.INCOME;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout: ComponentLayoutStyleEnum) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter(
					(componentLayout: ComponentLayoutStyleEnum) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => (this.incomes = [])),
				tap(() => this.incomes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			mode: 'external',
			selectedRowIndex: -1,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.INCOME'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '15%',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				client: {
					title: this.getTranslation('SM_TABLE.CONTACT'),
					type: 'custom',
					width: '20%',
					renderComponent: ContactLinksComponent,
					componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					},
					isFilterable: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact | null) => {
						this.setFilter({ field: 'clientId', search: value?.id || null });
					}
				},
				employee: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					isFilterable: false,
					width: '15%',
					type: 'custom',
					sort: false,
					renderComponent: EmployeeLinksComponent,
					componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				amount: {
					title: this.getTranslation('SM_TABLE.VALUE'),
					type: 'custom',
					width: '10%',
					isFilterable: false,
					renderComponent: IncomeExpenseAmountComponent,
					componentInitFunction: (instance: IncomeExpenseAmountComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'text',
					class: 'align-row',
					width: '25%',
					isFilterable: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'notes', search: value });
					}
				},
				tags: {
					title: this.getTranslation('SM_TABLE.TAGS'),
					type: 'custom',
					width: '15%',
					class: 'align-row',
					renderComponent: TagsOnlyComponent,
					componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					isFilterable: {
						type: 'custom',
						component: TagsColorFilterComponent
					},
					filterFunction: (tags: ITag[]) => {
						const tagIds = [];
						for (const tag of tags) {
							tagIds.push(tag.id);
						}
						this.setFilter({ field: 'tags', search: tagIds });
					},
					sort: false
				}
			}
		};
	}

	/**
	 * Listens for language changes and triggers the loading of Smart Table settings.
	 * Unsubscribes when the component is destroyed.
	 */
	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Adds a new income.
	 */
	async addIncome(): Promise<void> {
		// Open the dialog to add a new income
		const dialogRef = this.dialogService.open(IncomeMutationComponent);

		// Wait for the dialog to close and get the result
		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				// If there is a result, proceed with creating a new income
				if (dialogResult) {
					const { tenantId } = this.store.user;
					const { id: organizationId } = this.organization;
					const { amount, organizationContact, valueDate, employee, notes, currency, isBonus, tags } =
						dialogResult;

					// Create a new income using the service
					await this.incomeService.create({
						amount,
						clientId: organizationContact.id,
						valueDate: moment(valueDate).startOf('day').toDate(),
						employeeId: employee ? employee.id : null,
						organizationId,
						tenantId,
						notes,
						currency,
						isBonus,
						tags
					});

					// Display success message
					this.toastrService.success('NOTES.INCOME.ADD_INCOME', {
						name: this.employeeName(employee)
					});

					// Refresh date range picker and trigger data refresh
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(valueDate));
				}
			} catch (error) {
				// Handle errors during the process
				this.toastrService.danger(error);
			} finally {
				this._refresh$.next(true);
				this.incomes$.next(true);
			}
		});
	}

	/**
	 * Handles the selection of an income item.
	 *
	 * @param {boolean} isSelected - A boolean indicating whether the income item is selected.
	 * @param {IIncome} data - The data of the selected income item.
	 */
	selectIncome({ isSelected, data }: { isSelected: boolean; data: IIncome }): void {
		this.disableButton = !isSelected;
		this.selectedIncome = isSelected ? data : null;
	}

	/**
	 * Edits the selected income.
	 *
	 * @param selectedItem - The selected income to be edited.
	 */
	async editIncome(selectedItem?: IIncome): Promise<void> {
		// If there is a selected item, update the selected income
		if (selectedItem) {
			this.selectIncome({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the dialog to edit the income
		const dialogRef = this.dialogService.open(IncomeMutationComponent, {
			context: {
				income: this.selectedIncome
			}
		});

		// Wait for the dialog to close and get the result
		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				// If there is a result, proceed with updating the income
				if (dialogResult) {
					const { amount, organizationContact, valueDate, notes, currency, isBonus, tags } = dialogResult;
					const { employee } = this.selectedIncome;

					const { id: organizationId, tenantId } = this.organization;

					// Update the income using the service
					await this.incomeService.update(this.selectedIncome.id, {
						amount,
						clientId: organizationContact.id,
						valueDate: moment(valueDate).startOf('day').toDate(),
						notes,
						currency,
						isBonus,
						tags,
						employeeId: employee ? employee.id : null,
						tenantId,
						organizationId
					});

					// Display success message
					this.toastrService.success('NOTES.INCOME.EDIT_INCOME', {
						name: this.employeeName(employee)
					});

					// Refresh date range picker and trigger data refresh
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(valueDate));
				}
			} catch (error) {
				// Handle errors during the process
				this.errorHandler.handleError(error);
			} finally {
				this._refresh$.next(true);
				this.incomes$.next(true);
			}
		});
	}

	/**
	 * Deletes the selected income.
	 *
	 * @param selectedItem - The selected income to be deleted.
	 */
	async deleteIncome(selectedItem?: IIncome): Promise<void> {
		if (selectedItem) {
			this.selectIncome({
				isSelected: true,
				data: selectedItem
			});
		}

		const confirmationDialogRef = this.dialogService.open(DeleteConfirmationComponent, {
			context: {
				recordType: this.getTranslation('INCOME_PAGE.INCOME')
			}
		});

		confirmationDialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			if (dialogResult) {
				try {
					const { id: organizationId, tenantId } = this.organization;
					const { id, employee, employeeId } = this.selectedIncome;

					await this.incomeService.delete(id, {
						employeeId,
						organizationId,
						tenantId
					});

					this.toastrService.success('NOTES.INCOME.DELETE_INCOME', {
						name: this.employeeName(employee)
					});
				} catch (error) {
					this.errorHandler.handleError(error);
				} finally {
					this._refresh$.next(true);
					this.incomes$.next(true);
				}
			}
		});
	}

	/**
	 * Sets up a ServerDataSource for retrieving income data from a server.
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/income/pagination`,
			relations: ['employee', 'employee.user', 'tags', 'organization', 'client'],
			join: {
				alias: 'income',
				leftJoin: {
					tags: 'income.tags'
				},
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployeeId ? { employeeId: this.selectedEmployeeId } : {}),
				valueDate: {
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (income: IIncome): any => ({
				...income,
				employeeName: income.employee ? income.employee.fullName : null,
				clientName: income.client ? income.client.name : null,
				employee: { ...employeeMapper(income) }
			}),
			finalize: () => {
				if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
					this.incomes.push(...this.smartTableSource.getData());
				}
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	/**
	 * Fetches and displays incomes.
	 */
	private async getIncomes(): Promise<void> {
		try {
			// Check if the organization is available
			if (!this.organization) {
				return;
			}

			// Set up the smart table source
			this.setSmartTableSource();

			// Get pagination details
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the smart table source
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Fetch elements based on the data layout style
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			// Handle errors by displaying a danger toastr message
			this.toastrService.danger(error);
		}
	}

	/*
	 * Clear selected item
	 */
	private _clearItem() {
		this.selectIncome({ isSelected: false, data: null });
	}

	/**
	 * Gets the name of an employee.
	 * @param employee - The employee for which to retrieve the name.
	 * @returns The full name of the employee or the first name of the default employee if not available.
	 */
	employeeName(employee: IEmployee): string {
		return employee && employee.id ? employee.fullName.trim() : ALL_EMPLOYEES_SELECTED.firstName;
	}

	ngOnDestroy() {}
}
