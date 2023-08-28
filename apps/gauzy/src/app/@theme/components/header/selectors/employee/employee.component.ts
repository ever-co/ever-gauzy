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
import {
	CrudActionEnum,
	DEFAULT_TYPE,
	IDateRangePicker,
	IEmployee,
	IOrganization,
	ISelectedEmployee,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, map, Observable, Subject } from 'rxjs';
import { filter, debounceTime, tap, switchMap } from 'rxjs/operators';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { ALL_EMPLOYEES_SELECTED } from './default-employee';
import {
	DateRangePickerBuilderService,
	EmployeesService,
	EmployeeStore,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { TruncatePipe } from './../../../../../@shared/pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-selector',
	templateUrl: './employee.component.html',
	styleUrls: ['./employee.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeSelectorComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {

	/*
	* Getter & Setter for dynamic clearable option
	*/
	_clearable: boolean = true;
	get clearable(): boolean {
		return this._clearable;
	}
	@Input() set clearable(value: boolean) {
		this._clearable = value;
	}

	/*
	 * Getter & Setter for dynamic add tag option
	 */
	_addTag: boolean = true;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	private _skipGlobalChange: boolean = false;
	get skipGlobalChange(): boolean {
		return this._skipGlobalChange;
	}
	@Input() set skipGlobalChange(value: boolean) {
		this._skipGlobalChange = value;
	}

	/*
	* Getter & Setter for dynamic disabled element
	*/
	private _disabled: boolean = false;
	get disabled(): boolean {
		return this._disabled;
	}
	@Input() set disabled(value: boolean) {
		this._disabled = value;
	}

	/*
	* Getter & Setter for dynamic placeholder
	*/
	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/**
	 *
	 */
	private _defaultSelected: boolean = true;
	get defaultSelected(): boolean {
		return this._defaultSelected;
	}
	@Input() set defaultSelected(value: boolean) {
		this._defaultSelected = value;
	}

	/**
	 *
	 */
	private _showAllEmployeesOption: boolean = true;
	get showAllEmployeesOption(): boolean {
		return this._showAllEmployeesOption;
	}
	@Input() set showAllEmployeesOption(value: boolean) {
		this._showAllEmployeesOption = value;
	}

	/**
	 *
	 */
	private _selectedDateRange?: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	@Input() set selectedDateRange(range: IDateRangePicker) {
		//This will set _selectedDateRange too
		this.subject$.next([this.store.selectedOrganization, range]);
	}

	/**
	 *
	 */
	private _selectedEmployee: ISelectedEmployee;
	get selectedEmployee(): ISelectedEmployee {
		return this._selectedEmployee;
	}
	@Input() set selectedEmployee(employee: ISelectedEmployee) {
		this._selectedEmployee = employee;
	}

	@Output() selectionChanged: EventEmitter<ISelectedEmployee> = new EventEmitter();

	public hasEditEmployee$: Observable<boolean>;
	public organization: IOrganization;
	people: ISelectedEmployee[] = [];
	subject$: Subject<any> = new Subject();

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly activatedRoute: ActivatedRoute,
		private readonly cdRef: ChangeDetectorRef,
		private readonly _employeeStore: EmployeeStore,
		private readonly toastrService: ToastrService,
		private readonly _truncatePipe: TruncatePipe,
		private readonly router: Router
	) { }

	ngOnInit() {
		this.onSelectEmployee();
		this.hasEditEmployee$ = this.store.userRolePermissions$.pipe(
			map(() =>
				this.store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)
			)
		);
		this.subject$
			.pipe(
				debounceTime(200),
				switchMap(async ([organization, dateRange]) => {
					await this.loadWorkingEmployeesIfRequired(
						organization,
						dateRange
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				distinctUntilChange(),
				filter((employee: ISelectedEmployee) => !!employee),
				tap((employee: ISelectedEmployee) => {
					if (this.defaultSelected) {
						this.selectedEmployee = employee;
						this.selectionChanged.emit(employee);
					}
					this.cdRef.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.queryParams
			.pipe(
				filter((query) => !!query.employeeId),
				tap(({ employeeId }) => this.selectEmployeeById(employeeId)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
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
		this.cdRef.detectChanges();
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
		this.cdRef.detectChanges();
	}

	/*
	 * After create new employee pushed on header selector
	 */
	createEmployee(employees: IEmployee[]) {
		const people: ISelectedEmployee[] = this.people || [];
		if (Array.isArray(people)) {
			employees.forEach((employee: IEmployee) => {
				people.push({
					id: employee.id,
					firstName: employee.user.firstName,
					lastName: employee.user.lastName,
					fullName: employee.user.name,
					imageUrl: employee.user.imageUrl
				});
			});
			this.people = [...people].filter(isNotEmpty);
		}
	}

	/*
	 * After delete remove employee from header selector
	 */
	deleteEmployee(employee: IEmployee) {
		let people: ISelectedEmployee[] = this.people || [];
		if (Array.isArray(people) && people.length) {
			people = people.filter(
				(item: ISelectedEmployee) => item.id !== employee.id
			);
		}
		this.people = [...people].filter(isNotEmpty);
	}

	searchEmployee(term: string, item: any) {
		if (item.firstName && item.lastName) {
			return (
				item.firstName.toLowerCase().includes(term.toLowerCase()) ||
				item.lastName.toLowerCase().includes(term.toLowerCase())
			);
		} else if (item.firstName) {
			return item.firstName.toLowerCase().includes(term.toLowerCase());
		} else if (item.lastName) {
			return item.lastName.toLowerCase().includes(term.toLowerCase());
		}
	}

	selectEmployee(employee: ISelectedEmployee) {
		if (!this.skipGlobalChange) {
			this.store.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
			this.setAttributesToParams({ employeeId: employee?.id })
		} else {
			this.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
		}
		if (isNotEmpty(employee)) {
			this.selectionChanged.emit(employee);
		}
	}


	private setAttributesToParams(params: Object) {
		this.router.navigate([], {
			relativeTo: this.activatedRoute,
			queryParams: { ...params },
			queryParamsHandling: 'merge',
		});
	}

	selectEmployeeById(employeeId: string) {
		const employee = this.people.find(
			(employee: ISelectedEmployee) => employeeId === employee.id
		);
		if (employee) {
			this.selectEmployee(employee);
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

	private onSelectEmployee() {
		if (!this.selectedEmployee && isNotEmpty(this.people)) {
			// This is so selected employee doesn't get reset when it's already set from somewhere else
			this.selectEmployee(this.people[0]);
		}
		if (
			!this.defaultSelected &&
			this.selectedEmployee === ALL_EMPLOYEES_SELECTED
		) {
			this.selectedEmployee = null;
		}
	}

	loadWorkingEmployeesIfRequired = async (
		organization: IOrganization,
		selectedDateRange: IDateRangePicker
	) => {
		//If no organization, then something is wrong
		if (!organization) {
			this.people = [];
			return;
		}
		this._selectedDateRange = selectedDateRange;
		await this.getEmployees(organization, selectedDateRange);
	};

	private getEmployees = async (
		organization: IOrganization,
		selectedDateRange: IDateRangePicker
	) => {
		if (!organization) {
			this.people = [];
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = organization;

		const { items } = await this.employeesService.getWorking(
			organizationId,
			tenantId,
			selectedDateRange,
			true
		);

		this.people = [
			...items.map((employee: IEmployee) => {
				return {
					id: employee.id,
					firstName: employee.user.firstName,
					lastName: employee.user.lastName,
					fullName: employee.user.name,
					imageUrl: employee.user.imageUrl,
					shortDescription: employee.short_description,
					employeeLevel: employee.employeeLevel,
					billRateCurrency: employee.billRateCurrency,
					billRateValue: employee.billRateValue
				} as ISelectedEmployee;
			})
		];

		//Insert All Employees Option
		if (
			this.showAllEmployeesOption &&
			this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
		) {
			this.people.unshift(ALL_EMPLOYEES_SELECTED);
		}

		//Set selected employee if no employee selected
		if (items.length > 0 && !this.store.selectedEmployee) {
			this.store.selectedEmployee =
				this.people[0] || ALL_EMPLOYEES_SELECTED;
		}
	};

	ngOnDestroy() {
		if (
			this.people.length > 0 &&
			!this.store.selectedEmployee &&
			!this.skipGlobalChange
		) {
			this.store.selectedEmployee =
				this.people[0] || ALL_EMPLOYEES_SELECTED;
		}
	}

	/**
	 * Display clearable option in employee selector
	 *
	 * @returns
	 */
	isClearable(): boolean {
		if (this.clearable) {
			if (
				this.selectedEmployee &&
				this.selectedEmployee.hasOwnProperty('defaultType')
			) {
				if (
					this.selectedEmployee.defaultType === DEFAULT_TYPE.ALL_EMPLOYEE
				) {
					return false;
				}
			}
			return !!this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
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

			this.router.navigate(['/pages/employees/'], {
				queryParams: {
					openAddDialog: true
				},
				state: {
					firstName,
					lastName
				}
			});
		} catch (error) {
			this.toastrService.error(error);
		}
	};
}
