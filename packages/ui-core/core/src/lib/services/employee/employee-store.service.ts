import {
	IEmployee,
	IEmployeeUpdateInput,
	IUserFindInput,
	IEmployeeStoreState,
	IUserUpdateInput
} from '@gauzy/contracts';
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
import { Query, Store as AkitaStore, StoreConfig } from '@datorama/akita';

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'employee', resettable: true })
export class EmployeeAkitaStore extends AkitaStore<IEmployeeStoreState> {
	constructor() {
		super({} as IEmployeeStoreState);
	}
}

@Injectable({ providedIn: 'root' })
export class EmployeeAkitaQuery extends Query<IEmployeeStoreState> {
	constructor(store: EmployeeAkitaStore) {
		super(store);
	}
}

/**
 * Service used to update employee
 */
@Injectable()
export class EmployeeStore {
	private _selectedEmployee: IEmployee;
	private _userForm: IUserFindInput;
	private _employeeForm: IEmployeeUpdateInput;

	constructor(protected employeeAkitaStore: EmployeeAkitaStore, protected employeeAkitaQuery: EmployeeAkitaQuery) {}

	selectedEmployee$: BehaviorSubject<IEmployee> = new BehaviorSubject(this.selectedEmployee);

	userForm$: BehaviorSubject<IUserFindInput> = new BehaviorSubject(this.userForm);

	employeeForm$: BehaviorSubject<IEmployeeUpdateInput> = new BehaviorSubject(this.employeeForm);

	set selectedEmployee(employee: IEmployee) {
		this._selectedEmployee = employee;
		this.selectedEmployee$.next(employee);
	}

	get selectedEmployee(): IEmployee {
		return this._selectedEmployee;
	}

	employeeAction$ = this.employeeAkitaQuery.select(({ action, employees }) => {
		return { action, employees };
	});

	set employeeAction({ action, employees }: IEmployeeStoreState) {
		this.employeeAkitaStore.update({
			action,
			employees
		});
	}

	set userForm(user: IUserUpdateInput) {
		this._userForm = user;
		this.userForm$.next(user);
	}

	get userForm(): IUserUpdateInput {
		return this._userForm;
	}

	set employeeForm(employee: IEmployeeUpdateInput) {
		this._employeeForm = employee;
		this.employeeForm$.next(employee);
	}

	get employeeForm(): IEmployeeUpdateInput {
		return this._employeeForm;
	}

	/**
	 * Update the user form with new data
	 *
	 * @param formData - The form data to update.
	 */
	async updateUserForm(formData: IUserUpdateInput) {
		// Simulate an async operation, such as an API call
		// await someApiService.update(formData);
		this.userForm = { ...this.userForm, ...formData };
	}

	/**
	 * Update the employee form with new data
	 *
	 * @param formData - The form data to update.
	 */
	async updateEmployeeForm(formData: IEmployeeUpdateInput) {
		// Simulate an async operation, such as an API call
		// await someApiService.updateEmployee(formData);
		this.employeeForm = { ...this.employeeForm, ...formData };
	}

	destroy() {
		this.employeeAkitaStore.reset();
	}
}
