import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	Output,
	EventEmitter,
	AfterViewInit,
	ChangeDetectorRef,
	ChangeDetectionStrategy
} from '@angular/core';
import { filter, debounceTime, tap, switchMap } from 'rxjs/operators';
import {
	CrudActionEnum,
	DEFAULT_TYPE,
	IDateRangePicker,
	IEmployee,
	IOrganization,
	ISelectedEmployee,
	PermissionsEnum
} from '@gauzy/contracts';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, map, Observable, Subject } from 'rxjs';
import { isEmpty, isNotEmpty } from '@gauzy/common-angular';
import { ALL_EMPLOYEES_SELECTED } from './default-employee';
import {
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
export class EmployeeSelectorComponent
	implements OnInit, OnDestroy, AfterViewInit {

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

	private _disabled: boolean = false;
	get disabled(): boolean {
		return this._disabled;
	}
	@Input() set disabled(value: boolean) {
		this._disabled = value;
	}

	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	private _defaultSelected: boolean = true;
	get defaultSelected(): boolean {
		return this._defaultSelected;
	}
	@Input() set defaultSelected(value: boolean) {
		this._defaultSelected = value;
	}

	private _showAllEmployeesOption: boolean = true;
	get showAllEmployeesOption(): boolean {
		return this._showAllEmployeesOption;
	}
	@Input() set showAllEmployeesOption(value: boolean) {
		this._showAllEmployeesOption = value;
	}

	private _selectedDateRange?: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	@Input() set selectedDateRange(range: IDateRangePicker) {
		//This will set _selectedDateRange too
		this.subject$.next([this.store.selectedOrganization, range]);
	}

	@Output()
	selectionChanged: EventEmitter<ISelectedEmployee> = new EventEmitter();

	public hasEditEmployee$: Observable<boolean>;
	public organization: IOrganization;
	selectedEmployee: ISelectedEmployee;
	people: ISelectedEmployee[] = [];
	subject$: Subject<any> = new Subject();

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly activatedRoute: ActivatedRoute,
		private readonly cdRef: ChangeDetectorRef,
		private readonly _employeeStore: EmployeeStore,
		private readonly toastrService: ToastrService,
		private readonly _truncatePipe: TruncatePipe,
		private readonly router: Router
	) {}

	ngOnInit() {
		this._selectedEmployee();
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
				filter((employee) => !!employee),
				tap((employee) => {
					if (this.defaultSelected) {
						this.selectedEmployee = employee;
					}
					this.cdRef.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.queryParams
			.pipe(
				debounceTime(500),
				filter((query) => !!query.employeeId),
				tap(({ employeeId }) => this.selectEmployeeById(employeeId)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, dateRange]) => {
					this.organization = organization;
					this._selectedDateRange = dateRange;
					this.subject$.next([organization, dateRange])
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

	/*
	 * After create new employee pushed on header selector
	 */
	createEmployee(employees: IEmployee[]) {
		const people: ISelectedEmployee[] = this.people || [];
		if (Array.isArray(people)) {
			employees.forEach((employee: IEmployee) => {
				people.push(
					{
						id: employee.id,
						firstName: employee.user.firstName,
						lastName: employee.user.lastName,
						fullName: employee.user.name,
						imageUrl: employee.user.imageUrl
					}
				);
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
		} else {
			this.selectedEmployee = employee;
		}
		this.selectionChanged.emit(employee);
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
	 * GET Shortend Name
	 * 
	 * @param firstName
	 * @param lastName
	 * @param limit
	 * @returns 
	 */
	getShortenedName(firstName: string, lastName: string, limit = 18) {
		if (firstName && lastName) {
			return this._truncatePipe.transform(firstName, limit/2, false, '') + ' ' + this._truncatePipe.transform(lastName, limit/2, false, '.');
		} else {
			return this._truncatePipe.transform(firstName, limit) || this._truncatePipe.transform(lastName, limit) || '[error: bad name]';
		}
	}

	private _selectedEmployee() {
		if (!this.selectedEmployee) {
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
			...items.map((e) => {
				return {
					id: e.id,
					firstName: e.user.firstName,
					lastName: e.user.lastName,
					fullName: e.user.name,
					imageUrl: e.user.imageUrl,
					shortDescription: e.short_description,
					employeeLevel: e.employeeLevel
				} as ISelectedEmployee;
			})
		];

		//Insert All Employees Option
		if (this.showAllEmployeesOption) {
			this.people.unshift(ALL_EMPLOYEES_SELECTED);
		}
		
		//Set selected employee if no employee selected
		if (items.length > 0 && !this.store.selectedEmployee) {
			this.store.selectedEmployee = this.people[0] || ALL_EMPLOYEES_SELECTED;
		}
	};

	ngOnDestroy() {
		if (
			this.people.length > 0 && 
			!this.store.selectedEmployee &&
			!this.skipGlobalChange
		) { 
			this.store.selectedEmployee = this.people[0] || ALL_EMPLOYEES_SELECTED;
		}
	}

	/**
	 * Display clearable option in employee selector
	 * 
	 * @returns 
	 */
	isClearable(): boolean {
		if (
			this.selectedEmployee &&
			this.selectedEmployee.hasOwnProperty('defaultType')
		) {
			if (this.selectedEmployee.defaultType === DEFAULT_TYPE.ALL_EMPLOYEE) {
				return false;
			}
		}
		return true;
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
