import { IEmployee, IEmployeeUpdateInput, IUserFindInput } from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

/**
 * Service used to update employee
 */
@Injectable()
export class EmployeeStore {
	private _selectedEmployee: IEmployee;
	private _userForm: IUserFindInput;
	private _employeeForm: IEmployeeUpdateInput;

	selectedEmployee$: BehaviorSubject<IEmployee> = new BehaviorSubject(
		this.selectedEmployee
	);

	userForm$: BehaviorSubject<IUserFindInput> = new BehaviorSubject(
		this.userForm
	);

	employeeForm$: BehaviorSubject<IEmployeeUpdateInput> = new BehaviorSubject(
		this.employeeForm
	);

	set selectedEmployee(employee: IEmployee) {
		this._selectedEmployee = employee;
		this.selectedEmployee$.next(employee);
	}

	get selectedEmployee(): IEmployee {
		return this._selectedEmployee;
	}

	set userForm(user: IUserFindInput) {
		this._userForm = user;
		this.userForm$.next(user);
	}

	get userForm(): IUserFindInput {
		return this._userForm;
	}

	set employeeForm(employee: IEmployeeUpdateInput) {
		this._employeeForm = employee;
		this.employeeForm$.next(employee);
	}

	get employeeForm(): IEmployeeUpdateInput {
		return this._employeeForm;
	}

	clear() {
		localStorage.clear();
	}
}
