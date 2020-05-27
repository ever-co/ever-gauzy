import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { takeUntil, filter, debounceTime } from 'rxjs/operators';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { Tag, Organization } from '@gauzy/models';
import { ActivatedRoute } from '@angular/router';
import { untilDestroyed } from 'ngx-take-until-destroy';

//TODO: Currently the whole application assumes that if employee or id is null then you need to get data for All Employees
//That should not be the case, sometimes due to permissions like CHANGE_SELECTED_EMPLOYEE not being available
//we need to handle cases where No Employee is selected too
export interface SelectedEmployee {
	id: string;
	firstName: string;
	lastName: string;
	imageUrl: string;
	defaultType?: DEFAULT_TYPE;
	tags?: Tag[];
}

export enum DEFAULT_TYPE {
	ALL_EMPLOYEE = 'ALL_EMPLOYEE',
	NO_EMPLOYEE = 'NO_EMPLOYEE'
}

export const ALL_EMPLOYEES_SELECTED: SelectedEmployee = {
	id: null,
	firstName: 'All Employees',
	lastName: '',
	imageUrl: 'https://i.imgur.com/XwA2T62.jpg',
	defaultType: DEFAULT_TYPE.ALL_EMPLOYEE,
	tags: []
};

export const NO_EMPLOYEE_SELECTED: SelectedEmployee = {
	id: null,
	firstName: '',
	lastName: '',
	imageUrl: '',
	defaultType: DEFAULT_TYPE.NO_EMPLOYEE,
	tags: []
};

@Component({
	selector: 'ga-employee-selector',
	templateUrl: './employee.component.html',
	styleUrls: ['./employee.component.scss']
})
export class EmployeeSelectorComponent implements OnInit, OnDestroy {
	@Input()
	skipGlobalChange: boolean;
	@Input()
	disabled: boolean;
	@Input()
	defaultSelected: boolean;
	@Input()
	showAllEmployeesOption: boolean;
	@Input()
	placeholder: string;

	@Input()
	set selectedDate(value: Date) {
		//This will set _selectDate too
		this.loadWorkingEmployeesIfRequired(
			this.store.selectedOrganization,
			value
		);
	}

	get selectedDate() {
		return this._selectedDate;
	}

	private _selectedOrganization?: Organization;
	private _selectedDate?: Date;

	@Output()
	selectionChanged: EventEmitter<SelectedEmployee> = new EventEmitter();

	people: SelectedEmployee[] = [];
	selectedEmployee: SelectedEmployee;

	private _ngDestroy$ = new Subject<void>();

	constructor(
		private employeesService: EmployeesService,
		private store: Store,
		private activatedRoute: ActivatedRoute
	) {}

	ngOnInit() {
		this.defaultSelected =
			this.defaultSelected === undefined ? true : this.defaultSelected;
		this.showAllEmployeesOption =
			this.showAllEmployeesOption === undefined
				? true
				: this.showAllEmployeesOption;

		this._loadEmployees();
		this._loadEmployeeId();

		this.activatedRoute.queryParams
			.pipe(
				debounceTime(500),
				filter((query) => !!query.employeeId),
				untilDestroyed(this)
			)
			.subscribe((query) => {
				this.selectEmployeeById(query.employeeId);
			});
	}

	searchEmployee(term: string, item: any) {
		if (item.firstName && item.lastName) {
			return (
				item.firstName.toLowerCase().includes(term) ||
				item.lastName.toLowerCase().includes(term)
			);
		} else if (item.firstName) {
			return item.firstName.toLowerCase().includes(term);
		} else if (item.lastName) {
			return item.lastName.toLowerCase().includes(term);
		}
	}

	selectEmployee(employee: SelectedEmployee) {
		if (!this.skipGlobalChange) {
			this.store.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
		} else {
			this.selectedEmployee = employee;
		}
		this.selectionChanged.emit(employee);
	}

	selectEmployeeById(employeeId: string) {
		const employeies = this.people.filter(
			(employee: SelectedEmployee) => employeeId === employee.id
		);
		if (employeies.length > 0) {
			this.selectEmployee(employeies[0]);
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

	private _loadEmployeeId() {
		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				this.selectedEmployee = emp;
			});
	}

	private async _loadEmployees() {
		this.store.selectedOrganization$.subscribe(async (org) => {
			if (org) {
				await this.loadWorkingEmployeesIfRequired(
					org,
					this.store.selectedDate
				);
			}
		});

		this.store.selectedDate$.subscribe((date) => {
			this.loadWorkingEmployeesIfRequired(
				this.store.selectedOrganization,
				date
			);
		});

		if (!this.selectedEmployee) {
			// This is so selected employee doesn't get reset when it's already set from somewhere else
			this.selectEmployee(this.people[0]);
		}

		if (
			!this.defaultSelected &&
			this.selectedEmployee === ALL_EMPLOYEES_SELECTED
		)
			this.selectedEmployee = null;
	}

	loadWorkingEmployeesIfRequired = async (
		org: Organization,
		selectedDate: Date
	) => {
		//If no organization, then something is wrong
		if (!org) {
			this.people = [];
			return;
		}

		//Save repeated API calls for the same organization & date
		if (
			this._selectedOrganization &&
			this._selectedDate &&
			selectedDate &&
			org.id === this._selectedOrganization.id &&
			selectedDate.getTime() === this._selectedDate.getTime()
		) {
			return;
		}

		this._selectedOrganization = org;
		this._selectedDate = selectedDate;

		const { items } = await this.employeesService.getWorking(
			org.id,
			selectedDate,
			true
		);

		this.people = [
			...items.map((e) => {
				return {
					id: e.id,
					firstName: e.user.firstName,
					lastName: e.user.lastName,
					imageUrl: e.user.imageUrl
				};
			})
		];

		//Insert All Employees Option
		if (this.showAllEmployeesOption) {
			this.people.unshift(ALL_EMPLOYEES_SELECTED);
		}

		//Set selected employee if no employee selected
		if (items.length > 0 && !this.store.selectedEmployee) {
			this.store.selectedEmployee =
				this.people[0] || ALL_EMPLOYEES_SELECTED;
		}
	};

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
