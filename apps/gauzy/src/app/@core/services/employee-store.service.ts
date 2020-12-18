import {
	IEmployee,
	IEmployeeUpdateInput,
	IUserFindInput,
	IEmployeeStoreState,
	EmployeeAction,
	SelectedEmployee
} from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
import { Query, Store as AkitaStore, StoreConfig } from '@datorama/akita';

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'app' })
export class IEmployeeStore extends AkitaStore<IEmployeeStoreState> {
	constructor() {
		super({} as IEmployeeStoreState);
	}
}

@Injectable({ providedIn: 'root' })
export class IEmployeeQuery extends Query<IEmployeeStoreState> {
	constructor(protected store: IEmployeeStore) {
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

	constructor(
		protected iEmployeeStore: IEmployeeStore,
		protected iEmployeeQuery: IEmployeeQuery
	) {}

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

	employeeAction$ = this.iEmployeeQuery.select(({ employee, action }) => {
		return { employee, action };
	});

	set employeeAction({
		employee,
		action
	}: {
		employee: SelectedEmployee;
		action: EmployeeAction;
	}) {
		this.iEmployeeStore.update({
			employee: employee.user,
			action
		});
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
