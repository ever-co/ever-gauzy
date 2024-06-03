import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { IEmployee, IEmployeeJobsStatisticsResponse, IOrganization, ISelectedEmployee } from '@gauzy/contracts';
import { EmployeeLinksComponent } from './../../../../@shared/table-components';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from './../../../../@shared/pagination/pagination-filter-base.component';
import { Store } from '@gauzy/ui-sdk/common';
import { EmployeesService } from './../../../../@core/services';
import { SmartTableToggleComponent } from './../../../../@shared/smart-table/smart-table-toggle/smart-table-toggle.component';
import { ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { NumberEditorComponent } from 'apps/gauzy/src/app/@shared/table-components/editors/number-editor.component';

export enum JobSearchTabsEnum {
	BROWSE = 'BROWSE',
	SEARCH = 'SEARCH',
	HISTORY = 'HISTORY'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-employees',
	templateUrl: './employees.component.html',
	styleUrls: ['./employees.component.scss'],
	providers: [CurrencyPipe]
})
export class EmployeesComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public jobSearchTabsEnum = JobSearchTabsEnum;
	public loading: boolean = false;
	public settingsSmartTable: any;
	public employees$: Subject<any> = new Subject();
	public smartTableSource: ServerDataSource;
	public selectedEmployeeId: ISelectedEmployee['id'];
	public organization: IOrganization;
	public nbTab$: Subject<string> = new BehaviorSubject(JobSearchTabsEnum.BROWSE);
	public selectedEmployee: IEmployee;
	public disableButton: boolean = true;

	constructor(
		private readonly http: HttpClient,
		private readonly router: Router,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly employeesService: EmployeesService,
		private readonly toastrService: ToastrService,
		private readonly currencyPipe: CurrencyPipe
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	ngAfterViewInit(): void {
		// Subscribe to the employees$ observable with debounce time and untilDestroyed operators
		this.employees$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Perform side effect by triggering the getActiveJobEmployees method
				tap(() => this.getActiveJobEmployees()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the pagination$ observable with debounce time, distinctUntilChange, and untilDestroyed operators
		this.pagination$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure that the value has changed before emitting it
				distinctUntilChange(),
				// Perform side effect by triggering the employees$ observable with true
				tap(() => this.employees$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Combine selectedOrganization$ and selectedEmployee$ observables
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;

		// Subscribe to the combined observables with debounce time, distinctUntilChange, filter, tap, and untilDestroyed operators
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure that the value has changed before emitting it
				distinctUntilChange(),
				// Filter out combinations where organization is falsy
				filter(([organization]) => !!organization),
				// Perform side effects: update organization and selectedEmployeeId, trigger employees$ observable
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this.employees$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Registers and configures the Smart Table source.
	 */
	setSmartTableSource(): void {
		// Check if organization context is available
		if (!this.organization) {
			return;
		}

		// Set loading state to true while fetching data
		this.loading = true;

		// Destructure properties for clarity
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		// Create a new ServerDataSource for Smart Table
		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/employee/job-statistics`,
			relations: ['user'],
			// Define query parameters for the API request
			where: {
				tenantId,
				organizationId,
				isActive: true,
				...(this.selectedEmployeeId ? { id: this.selectedEmployeeId } : {}),
				...(this.filters.where ? this.filters.where : {})
			},
			// Finalize callback to handle post-processing
			finalize: () => {
				// Update pagination based on the count of items in the source
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				// Set loading state to false once data fetching is complete
				this.loading = false;
			}
		});
	}

	/**
	 * Retrieves employees with active jobs.
	 *
	 * @returns {Promise<void>} - A Promise resolving to void.
	 */
	async getActiveJobEmployees(): Promise<void> {
		try {
			// Ensure the organization context is available before proceeding.
			if (!this.organization) {
				return;
			}

			// Set up the smart table source for displaying active job employees.
			this.setSmartTableSource();

			// Retrieve pagination settings.
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the smart table source.
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			// Display an error toastr notification in case of any exceptions.
			this.toastrService.danger(error);
		}
	}

	private _loadSmartTableSettings(): void {
		// Retrieve pagination settings
		const pagination: IPaginationBase = this.getPagination();

		// Configure smart table settings
		this.settingsSmartTable = {
			selectedRowIndex: -1,
			hideSubHeader: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EMPLOYEE'),
			editable: true,
			actions: {
				delete: false
			},
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			edit: {
				editButtonContent: '<i class="nb-edit"></i>',
				saveButtonContent: '<i class="nb-checkmark"></i>',
				cancelButtonContent: '<i class="nb-close"></i>',
				confirmSave: true
			},
			columns: {
				employee: {
					title: this.getTranslation('JOB_EMPLOYEE.EMPLOYEE'),
					width: '30%',
					type: 'custom',
					sort: false,
					editable: false,
					renderComponent: EmployeeLinksComponent,
					valuePrepareFunction: (
						_: any,
						cell: Cell
					): { name: string | null; imageUrl: string | null; id: string | null } => {
						const employee: IEmployee | undefined = cell.getRow().getData();
						if (employee) {
							const { user, id } = employee;
							const name = user?.name || null;
							const imageUrl = user?.imageUrl || null;

							return { name, imageUrl, id };
						}
						return { name: null, imageUrl: null, id: null };
					},
					componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				availableJobs: {
					title: this.getTranslation('JOB_EMPLOYEE.AVAILABLE_JOBS'),
					type: 'text',
					width: '10%',
					sort: false,
					editable: false,
					valuePrepareFunction: (value: IEmployeeJobsStatisticsResponse['availableJobs']) => value || 0
				},
				appliedJobs: {
					title: this.getTranslation('JOB_EMPLOYEE.APPLIED_JOBS'),
					type: 'text',
					width: '10%',
					sort: false,
					editable: false,
					valuePrepareFunction: (value: IEmployeeJobsStatisticsResponse['appliedJobs']) => value || 0
				},
				billRateValue: {
					title: this.getTranslation('JOB_EMPLOYEE.BILLING_RATE'),
					type: 'text',
					width: '10%',
					sort: false,
					editable: true,
					editor: {
						type: 'custom',
						component: NumberEditorComponent
					},
					valuePrepareFunction: (value: number, cell: Cell) => {
						const employee: IEmployee = cell.getRow().getData();
						return this.currencyPipe.transform(value, employee?.billRateCurrency);
					}
				},
				minimumBillingRate: {
					title: this.getTranslation('JOB_EMPLOYEE.MINIMUM_BILLING_RATE'),
					type: 'text',
					width: '20%',
					sort: false,
					editable: true,
					editor: {
						type: 'custom',
						component: NumberEditorComponent
					},
					valuePrepareFunction: (value: number, cell: Cell) => {
						const employee: IEmployee = cell.getRow().getData();
						return this.currencyPipe.transform(value, employee?.billRateCurrency);
					}
				},
				isJobSearchActive: {
					title: this.getTranslation('JOB_EMPLOYEE.JOB_SEARCH_STATUS'),
					type: 'custom',
					width: '20%',
					editable: false,
					renderComponent: SmartTableToggleComponent,
					valuePrepareFunction: (_: any, cell: Cell) => {
						const employee: IEmployee = cell.getRow().getData();
						return {
							checked: employee.isJobSearchActive,
							onChange: (toggle: boolean) => this.updateJobSearchAvailability(employee, toggle)
						};
					},
					componentInitFunction: (instance: SmartTableToggleComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	/**
	 * Handles the event for confirming the edit of an editable field.
	 *
	 * @param event - The event containing the edited data.
	 */
	async onEditConfirm(event: any): Promise<void> {
		try {
			// Ensure the organization context is available before proceeding.
			if (!this.organization) {
				return;
			}

			// Destructure properties for clarity.
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const employeeId = event.data?.id;
			const { billRateValue, minimumBillingRate } = event.newData ?? {};

			// Update employee bill rates.
			await this.employeesService.updateProfile(employeeId, {
				minimumBillingRate,
				billRateValue,
				tenantId,
				organizationId
			});

			// If successful, refresh the smart table source.
			this.employees$.next(true);
		} catch (error) {
			console.error('Error while updating employee rates', error);
			// If an error occurs, reject the edit and log the error.
			await event.confirm.reject();
		}
	}

	/**
	 * Updates the job search availability status of an employee within the organization.
	 * @param employee - The employee object to update.
	 * @param isJobSearchActive - A boolean flag indicating whether the job search is active.
	 * @returns {Promise<void>} - A Promise resolving to void.
	 */
	async updateJobSearchAvailability(employee: IEmployee, isJobSearchActive: boolean): Promise<void> {
		try {
			// Ensure the organization context is available before proceeding.
			if (!this.organization) {
				return;
			}

			// Destructure organization properties for clarity.
			const { id: organizationId, tenantId } = this.organization;

			// Update the job search status using the employeesService.
			await this.employeesService.updateJobSearchStatus(employee.id, {
				isJobSearchActive,
				organizationId,
				tenantId
			});

			// Display a success toastr notification based on the job search status.
			const toastrMessageKey = isJobSearchActive
				? 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_ACTIVE'
				: 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_INACTIVE';

			this.toastrService.success(toastrMessageKey, {
				name: employee.fullName.trim()
			});
		} catch (error) {
			// Display an error toastr notification in case of any exceptions.
			this.toastrService.danger(error);
		}
	}

	/**
	 * Applies translations to the Smart Table settings when the language changes.
	 * This method listens for the onLangChange event from the translateService.
	 */
	private _applyTranslationOnSmartTable(): void {
		// Subscribe to language changes using onLangChange
		this.translateService.onLangChange
			.pipe(
				// Trigger the loading of Smart Table settings when the language changes
				tap(() => this._loadSmartTableSettings()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles the change of a tab.
	 *
	 * @param tab - The NbTabComponent representing the selected tab.
	 */
	onTabChange(tab: NbTabComponent) {}

	/**
	 * Handles the selection or deselection of an employee.
	 *
	 * @param param0 - Object containing selection information ({ isSelected, data }).
	 */
	onSelectEmployee({ isSelected, data }): void {
		// Update the disableButton flag based on whether an employee is selected
		this.disableButton = !isSelected;

		// Update the selectedEmployee based on the selection status
		this.selectedEmployee = isSelected ? data : null;
	}

	/**
	 * Edit employee.
	 *
	 * @param selectedItem - The employee to be edited.
	 */
	edit(selectedItem?: IEmployee): void {
		// If a specific employee is selected, update the selected employee state
		if (selectedItem) {
			this.onSelectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}

		// Navigate to the employee edit page
		this.router.navigate(['/pages/employees/edit/', this.selectedEmployee.id]);
	}

	ngOnDestroy(): void {}
}
