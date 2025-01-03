import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	Output,
	EventEmitter,
	AfterViewInit,
	ChangeDetectorRef,
	ChangeDetectionStrategy,
	OnChanges
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, map, Observable, Subject } from 'rxjs';
import { filter, debounceTime, tap, switchMap } from 'rxjs/operators';
import {
	CrudActionEnum,
	DEFAULT_TYPE,
	ID,
	IDateRangePicker,
	IEmployee,
	IOrganization,
	ISelectedEmployee,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	EmployeeStore,
	EmployeesService,
	NavigationService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { TruncatePipe } from '../../pipes';
import { ALL_EMPLOYEES_SELECTED } from './default-employee';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-employee-selector',
    templateUrl: './employee.component.html',
    styleUrls: ['./employee.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class EmployeeSelectorComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
	public hasEditEmployee$: Observable<boolean>;
	public organization: IOrganization;
	public employees: ISelectedEmployee[] = [];
	public subject$: Subject<any> = new Subject();

	/**
	 * Input properties for component customization.
	 *
	 * @property clearable - Whether the component allows clearing the selection (default: true).
	 * @property addTag - Whether adding new tags is allowed (default: true).
	 * @property skipGlobalChange - Whether to skip global change handling (default: false).
	 * @property disabled - Whether the component is disabled (default: false).
	 * @property placeholder - The placeholder text for the component.
	 * @property defaultSelected - Whether the default option is selected (default: true).
	 * @property showAllEmployeesOption - Whether to show the "All Employees" option (default: true).
	 */
	@Input() clearable: boolean = true;
	@Input() addTag: boolean = true;
	@Input() skipGlobalChange: boolean = false;
	@Input() disabled: boolean = false;
	@Input() placeholder: string;
	@Input() defaultSelected: boolean = true;
	@Input() showAllEmployeesOption: boolean = true;

	/**
	 * Manages the selected date range.
	 *
	 * The `selectedDateRange` setter updates the date range and triggers an update via `subject$.next`
	 * with the selected organization and date range.
	 *
	 * @property selectedDateRange - The currently selected date range.
	 */
	private _selectedDateRange?: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	@Input() set selectedDateRange(range: IDateRangePicker) {
		//This will set _selectedDateRange too
		this.subject$.next([this._store.selectedOrganization, range]);
	}

	/**
	 * Manages the selected employee.
	 *
	 * The `selectedEmployee` setter updates the selected employee and logs the change for debugging.
	 *
	 * @property selectedEmployee - The currently selected employee.
	 */
	private _selectedEmployee: ISelectedEmployee;
	get selectedEmployee(): ISelectedEmployee {
		return this._selectedEmployee;
	}
	@Input() set selectedEmployee(employee: ISelectedEmployee) {
		this._selectedEmployee = employee;

		// If skipGlobalChange is false, update the query parameters
		if (!this.skipGlobalChange) {
			this.setAttributesToParams({ employeeId: employee?.id });
		}
	}

	@Output() selectionChanged: EventEmitter<ISelectedEmployee> = new EventEmitter();

	constructor(
		private readonly _router: Router,
		private readonly _navigationService: NavigationService,
		private readonly _employeesService: EmployeesService,
		private readonly _store: Store,
		private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _cdRef: ChangeDetectorRef,
		private readonly _employeeStore: EmployeeStore,
		private readonly _toastrService: ToastrService,
		private readonly _truncatePipe: TruncatePipe
	) {}

	ngOnInit() {
		this.onSelectEmployee();
		this.hasEditEmployee$ = this._store.userRolePermissions$.pipe(
			map(() => this._store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT))
		);
		this.subject$
			.pipe(
				debounceTime(200),
				switchMap(async ([organization, dateRange]) => {
					await this.loadWorkingEmployeesIfRequired(organization, dateRange);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.selectedEmployee$
			.pipe(
				distinctUntilChange(),
				filter((employee: ISelectedEmployee) => !!employee),
				tap((employee: ISelectedEmployee) => {
					if (this.defaultSelected) {
						this.selectedEmployee = employee;
						this.selectionChanged.emit(employee);
					}
					this._cdRef.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._activatedRoute.queryParams
			.pipe(
				filter((query) => !!query.employeeId),
				tap(({ employeeId }) => this.selectEmployeeById(employeeId)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this._store.selectedOrganization$;
		const selectedDateRange$ = this._dateRangePickerBuilderService.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, dateRange]) => {
					this.organization = organization as IOrganization;
					this._selectedDateRange = dateRange as IDateRangePicker;
					this.subject$.next([organization, dateRange]);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this._cdRef.detectChanges();
		this._employeeStore.employeeAction$
			.pipe(
				filter(({ action, employees }) => !!action && !!employees),
				tap(() => this._employeeStore.destroy()),
				untilDestroyed(this)
			)
			.subscribe(({ action, employees }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
						this.createEmployee(employees);
						break;
					case CrudActionEnum.DELETED:
						const [employee] = employees;
						this.deleteEmployee(employee as IEmployee);
						break;
					default:
						break;
				}
			});
	}

	ngOnChanges() {
		this._cdRef.detectChanges();
	}

	/**
	 * Adds newly created employees to the header selector.
	 * @param employees - The array of employees to add.
	 */
	createEmployee(employees: IEmployee[]): void {
		this.employees = [
			...(this.employees || []),
			...employees.map((employee: IEmployee) => ({
				id: employee.id,
				firstName: employee.user.firstName,
				lastName: employee.user.lastName,
				fullName: employee.user.name,
				imageUrl: employee.user.imageUrl,
				timeFormat: employee.user.timeFormat,
				timeZone: employee.user.timeZone
			}))
		].filter(isNotEmpty);
	}

	/**
	 * Removes a deleted employee from the header selector.
	 * @param employee - The employee to remove.
	 */
	deleteEmployee(employee: IEmployee): void {
		this.employees = (this.employees || [])
			.filter((item: ISelectedEmployee) => item.id !== employee.id)
			.filter(isNotEmpty);
	}

	/**
	 * Searches for an employee by matching the provided search term with the employee's first name and/or last name.
	 * The search term can contain multiple words separated by spaces, and each word is matched individually against
	 * both the first and last names of the employee.
	 *
	 * @param term - The search term used to find matching employees. It can contain multiple words separated by spaces.
	 * @param item - The employee object containing `firstName` and `lastName` properties.
	 * @returns A boolean indicating whether any of the words in the search term match the first name or last name of the employee.
	 */
	searchEmployee(term: string, item: any): boolean {
		// Split the search term by commas to handle multiple names
		const searchTerms = term
			.toLowerCase()
			.split(',')
			.map((s) => s.trim());

		// Combine the employee's firstName and lastName for easier comparison
		const fullName = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();

		// Check if any search term matches the employee's full name
		return searchTerms.some((searchTerm) => {
			// Split the search term into individual words for handling names with spaces
			const keywords = searchTerm.split(' ');
			return keywords.some((keyword) => fullName.includes(keyword));
		});
	}

	/**
	 * Selects an employee and performs necessary actions based on selection
	 * @param employee The employee to select
	 */
	async selectEmployee(employee: ISelectedEmployee) {
		try {
			if (!this.skipGlobalChange) {
				this._store.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
				await this.setAttributesToParams({ employeeId: employee?.id });
			} else {
				this.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
			}

			if (isNotEmpty(employee)) {
				this.selectionChanged.emit(employee);
			}
		} catch (error) {
			console.error('Error while selecting employee:', error);
		}
	}

	/**
	 * Sets attributes to the current navigation parameters.
	 * @param params An object containing key-value pairs representing the parameters to set.
	 */
	private async setAttributesToParams(params: { [key: string]: string | string[] | boolean }) {
		await this._navigationService.updateQueryParams(params);
	}

	/**
	 * Selects an employee by their ID and performs necessary actions based on the selection.
	 *
	 * @param employeeId - The ID of the employee to select.
	 */
	async selectEmployeeById(employeeId: ID): Promise<void> {
		try {
			const employee = this.employees.find((emp: ISelectedEmployee) => emp.id === employeeId);
			if (employee) {
				await this.selectEmployee(employee);
			}
		} catch (error) {
			console.error('Error selecting employee by ID:', error);
		}
	}

	/**
	 * GET Shortened Name
	 *
	 * @param firstName
	 * @param lastName
	 * @param limit
	 * @returns
	 */
	getShortenedName(firstName: string, lastName: string, limit = 18) {
		if (firstName && lastName) {
			return (
				this._truncatePipe.transform(firstName, limit / 2, false, '') +
				' ' +
				this._truncatePipe.transform(lastName, limit / 2, false, '.')
			);
		} else {
			return (
				this._truncatePipe.transform(firstName, limit) ||
				this._truncatePipe.transform(lastName, limit) ||
				'[error: bad name]'
			);
		}
	}

	/**
	 * Handles the selection of an employee based on certain conditions
	 */
	private onSelectEmployee() {
		try {
			if (!this.selectedEmployee && isNotEmpty(this.employees)) {
				// Ensure selected employee doesn't get reset when already set elsewhere
				this.selectEmployee(this.employees[0]);
			}

			if (!this.defaultSelected && this.selectedEmployee === ALL_EMPLOYEES_SELECTED) {
				this.selectedEmployee = null;
			}
		} catch (error) {
			console.error('Error while handling employee selection:', error);
		}
	}

	/**
	 *
	 * @param organization
	 * @param selectedDateRange
	 * @returns
	 */
	loadWorkingEmployeesIfRequired = async (organization: IOrganization, selectedDateRange: IDateRangePicker) => {
		//If no organization, then something is wrong
		if (!organization) {
			this.employees = [];
			return;
		}
		this._selectedDateRange = selectedDateRange;
		await this.getEmployees(organization, selectedDateRange);
	};

	/**
	 *
	 * @param organization
	 * @param selectedDateRange
	 * @returns
	 */
	private getEmployees = async (organization: IOrganization, selectedDateRange: IDateRangePicker) => {
		if (!organization) {
			this.employees = [];
			return;
		}
		const { tenantId } = this._store.user;
		const { id: organizationId } = organization;

		const { items } = await this._employeesService.getWorking(organizationId, tenantId, selectedDateRange, true);

		this.employees = [
			...items.map((employee: IEmployee) => {
				return {
					id: employee.id,
					firstName: employee.user.firstName,
					lastName: employee.user.lastName,
					fullName: employee.user.name,
					imageUrl: employee.user.image?.fullUrl || employee.user.imageUrl,
					shortDescription: employee.short_description,
					employeeLevel: employee.employeeLevel,
					billRateCurrency: employee.billRateCurrency,
					billRateValue: employee.billRateValue,
					timeZone: employee.user.timeZone,
					timeFormat: employee.user.timeFormat
				} as ISelectedEmployee;
			})
		];

		//Insert All Employees Option
		if (this.showAllEmployeesOption && this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			this.employees.unshift(ALL_EMPLOYEES_SELECTED);
		}

		//Set selected employee if no employee selected
		if (items.length > 0 && !this._store.selectedEmployee) {
			this._store.selectedEmployee = this.employees[0] || ALL_EMPLOYEES_SELECTED;
		}
	};

	/**
	 * Display clearable option in employee selector
	 *
	 * @returns
	 */
	isClearable(): boolean {
		if (this.clearable) {
			if (this.selectedEmployee && this.selectedEmployee.hasOwnProperty('defaultType')) {
				if (this.selectedEmployee.defaultType === DEFAULT_TYPE.ALL_EMPLOYEE) {
					return false;
				}
			}
			return !!this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		}
	}

	/**
	 * Create new employee from ng-select tag
	 *
	 * @param name
	 * @returns
	 */
	createNew = async (name: string) => {
		if (!this.organization || !name) {
			return;
		}
		try {
			const chunks = name.split(/\s+/);
			const [firstName, lastName] = [chunks.shift(), chunks.join(' ')];

			this._router.navigate(['/pages/employees/'], {
				queryParams: { openAddDialog: true },
				state: { firstName, lastName }
			});
		} catch (error) {
			this._toastrService.error(error);
		}
	};

	ngOnDestroy() {
		if (this.employees.length > 0 && !this._store.selectedEmployee && !this.skipGlobalChange) {
			this._store.selectedEmployee = this.employees[0] || ALL_EMPLOYEES_SELECTED;
		}
	}
}
