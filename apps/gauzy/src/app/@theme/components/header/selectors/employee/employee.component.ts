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
import { EmployeesService } from './../../../../../@core/services/employees.service';
import { filter, debounceTime, tap, switchMap } from 'rxjs/operators';
import { Store } from './../../../../../@core/services/store.service';
import {
	CrudActionEnum,
	DEFAULT_TYPE,
	IEmployee,
	IOrganization,
	ISelectedEmployee
} from '@gauzy/contracts';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeeStore } from './../../../../../@core/services/employee-store.service';
import { combineLatest, Subject } from 'rxjs';
import { ALL_EMPLOYEES_SELECTED } from './default-employee';
import { isNotEmpty } from '@gauzy/common-angular';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-selector',
	templateUrl: './employee.component.html',
	styleUrls: ['./employee.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeSelectorComponent
	implements OnInit, OnDestroy, AfterViewInit {

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

	private _selectedDate?: Date;
	get selectedDate(): Date {
		return this._selectedDate;
	}
	@Input() set selectedDate(value: Date) {
		//This will set _selectDate too
		this.subject$.next([this.store.selectedOrganization, value]);
	}

	@Output()
	selectionChanged: EventEmitter<ISelectedEmployee> = new EventEmitter();

	people: ISelectedEmployee[] = [];
	selectedEmployee: ISelectedEmployee;
	subject$: Subject<any> = new Subject();

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly activatedRoute: ActivatedRoute,
		private readonly cdRef: ChangeDetectorRef,
		private readonly _employeeStore: EmployeeStore
	) {}

	ngOnInit() {
		this._selectedEmployee();
		this.subject$
			.pipe(
				debounceTime(200),
				switchMap(async ([organization, date]) => {
					await this.loadWorkingEmployeesIfRequired(
						organization,
						date
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
		const selectedDate$ = this.store.selectedDate$;
		combineLatest([storeOrganization$, selectedDate$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, date]) => {
					this._selectedDate = date;
					this.subject$.next([organization, date])
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
		this._employeeStore.employeeAction$
			.pipe(
				filter(({ action, employee }) => !!action && !!employee),
				tap(() => this._employeeStore.destroy()),
				untilDestroyed(this)
			)
			.subscribe(({ action, employee }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
						this.createEmployee(employee);
						break;
					case CrudActionEnum.DELETED:
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
	createEmployee(employees: IEmployee | IEmployee[]) {
		const people: ISelectedEmployee[] = this.people || [];
		if (Array.isArray(people)) {
			people.push(
				...employees.map((e) => {
					return {
						id: e.id,
						firstName: e.user.firstName,
						lastName: e.user.lastName,
						fullName: e.user.name,
						imageUrl: e.user.imageUrl
					};
				})
			);
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

	getShortenedName(firstName: string, lastName: string) {
		if (firstName && lastName) {
			return firstName + ' ' + lastName[0] + '.';
		} else {
			return firstName || lastName || '[error: bad name]';
		}
	}

	getFullName(firstName: string, lastName: string) {
		return firstName && lastName
			? firstName + ' ' + lastName
			: firstName || lastName;
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
		selectedDate: Date
	) => {
		//If no organization, then something is wrong
		if (!organization) {
			this.people = [];
			return;
		}
		this._selectedDate = selectedDate;
		await this.getEmployees(organization, selectedDate);
	};

	private getEmployees = async (organization: IOrganization, selectedDate: Date) => {
		if (!organization) {
			this.people = [];
			return;
		}
		const { tenantId } = this.store.user;
		const { id } = organization;
		const { items } = await this.employeesService.getWorking(
			id,
			tenantId,
			selectedDate,
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
				};
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
}
