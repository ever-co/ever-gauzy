import { EmploymentType } from '@gauzy/models';
import { BehaviorSubject, Observable } from 'rxjs';
import { Injectable } from '@angular/core';

/**
 * Service used to update employee
 */
@Injectable({
	providedIn: 'root'
})
export class EmploymentTypesStore {
	private _employmentTypes$: BehaviorSubject<
		EmploymentType[]
	> = new BehaviorSubject(null);
	public employmentTypes$: Observable<
		EmploymentType[]
	> = this._employmentTypes$.asObservable();

	loadAll(employmentTypes: EmploymentType[]) {
		this._employmentTypes$.next(employmentTypes);
	}

	create(employmentType: EmploymentType) {
		const empTypes = [...this._employmentTypes$.getValue(), employmentType];
		this._employmentTypes$.next(empTypes);
	}

	delete(id: number) {
		const empTypes = [...this._employmentTypes$.getValue()];
		const newValue = empTypes.filter((e) => e.id !== id);
		this._employmentTypes$.next(newValue);
	}
}
