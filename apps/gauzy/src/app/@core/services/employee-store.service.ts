import { Employee, EmployeeUpdateInput, UserFindInput } from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';

/**
 * Service used to update employee
 */
export class EmployeeStore {
	private _selectedEmployee: Employee;
	private _userForm: UserFindInput;
	private _employeeForm: EmployeeUpdateInput;

	selectedEmployee$: BehaviorSubject<Employee> = new BehaviorSubject(
		this.selectedEmployee
	);

	userForm$: BehaviorSubject<UserFindInput> = new BehaviorSubject(
		this.userForm
	);

	employeeForm$: BehaviorSubject<EmployeeUpdateInput> = new BehaviorSubject(
		this.employeeForm
	);

	set selectedEmployee(employee: Employee) {
		this._selectedEmployee = employee;
		this.selectedEmployee$.next(employee);
	}

	get selectedEmployee(): Employee {
		return this._selectedEmployee;
	}

	set userForm(user: UserFindInput) {
		this._userForm = user;
		this.userForm$.next(user);
	}

	get userForm(): UserFindInput {
		return this._userForm;
	}

	set employeeForm(employee: EmployeeUpdateInput) {
		this._employeeForm = employee;
		this.employeeForm$.next(employee);
	}

	get employeeForm(): EmployeeUpdateInput {
		return this._employeeForm;
	}

	clear() {
		localStorage.clear();
	}
}
