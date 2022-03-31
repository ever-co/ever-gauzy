import { Injectable } from '@angular/core';
import moment from 'moment';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	private _pickerRangeUnit$: BehaviorSubject<string> = new BehaviorSubject('month');
	public pickerRangeUnit$: Observable<string> = this._pickerRangeUnit$.asObservable();

	constructor() {}

	setPickerRangeUnit(unit: moment.unitOfTime.Base): void {
        this._pickerRangeUnit$.next(unit);
	}
}
