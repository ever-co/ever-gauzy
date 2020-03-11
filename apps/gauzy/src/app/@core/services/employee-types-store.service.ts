import { EmployeeType } from '@gauzy/models';
import { BehaviorSubject, Observable } from 'rxjs';
import { Injectable } from '@angular/core';

/**
 * Service used to update employee
 */
@Injectable({
	providedIn: 'root'
})
export class EmployeeTypesStore {
	private _employeeTypes$: BehaviorSubject<
		EmployeeType[]
	> = new BehaviorSubject(null);
	public employeeTypes$: Observable<
		EmployeeType[]
	> = this._employeeTypes$.asObservable();

	loadAll(employeeTypes: EmployeeType[]) {
		this._employeeTypes$.next(employeeTypes);
	}

	create(employeeType: EmployeeType) {
		const empTypes = [...this._employeeTypes$.getValue(), employeeType];
		this._employeeTypes$.next(empTypes);
	}

	delete(id: number) {
		const empTypes = [...this._employeeTypes$.getValue()];
		const newValue = empTypes.filter((e) => e.id !== id);
		this._employeeTypes$.next(newValue);
	}
}
