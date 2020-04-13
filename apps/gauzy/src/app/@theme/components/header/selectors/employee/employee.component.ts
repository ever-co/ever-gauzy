import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { takeUntil } from 'rxjs/operators';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { Tag } from '@gauzy/models';

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
		this._selectedDate = value;
		this.loadWorkingEmployees(this.store.selectedOrganization.id, value);
	}

	get selectedDate() {
		return this._selectedDate;
	}

	private _selectedDate?: Date;

	@Output()
	selectionChanged: EventEmitter<SelectedEmployee> = new EventEmitter();

	people: SelectedEmployee[] = [];
	selectedEmployee: SelectedEmployee;

	private _ngDestroy$ = new Subject<void>();

	constructor(
		private employeesService: EmployeesService,
		private store: Store
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
		}
		this.selectionChanged.emit(employee);
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
			if (org && this.store.selectedDate) {
				this.loadWorkingEmployees(org.id, this.store.selectedDate);
			}
		});

		this.store.selectedDate$.subscribe(async (date) => {
			if (date && this.store.selectedOrganization) {
				this.loadWorkingEmployees(
					this.store.selectedOrganization.id,
					date
				);
			}
		});

		if (!this.selectedEmployee) {
			// This is so selected employee doesn't get reset when it's already set from somewhere else
			this.selectEmployee(this.people[0]);
			this.selectedEmployee = this.people[0] || ALL_EMPLOYEES_SELECTED;
			this.store.selectedEmployee.id = null;
		}

		if (
			!this.defaultSelected &&
			this.selectedEmployee === ALL_EMPLOYEES_SELECTED
		)
			this.selectedEmployee = null;
	}

	loadWorkingEmployees = async (orgId: string, selectedDate: Date) => {
		const { items } = await this.employeesService.getWorking(
			orgId,
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
