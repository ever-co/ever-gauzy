import { Injectable } from '@angular/core';
import moment from 'moment';
import { isNotEmpty } from '@gauzy/common-angular';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	private _pickerRangeUnitOfTime$: BehaviorSubject<string> = new BehaviorSubject('month');
	public pickerRangeUnitOfTime$: Observable<string> = this._pickerRangeUnitOfTime$.asObservable();

	private _isLockDatePickerUnit$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isLockDatePickerUnit$: Observable<boolean> = this._isLockDatePickerUnit$.asObservable();

	constructor() {}

	setDatePickerConfig(options: any) {
		if (isNotEmpty(options)) {
			if (options.hasOwnProperty('unitOfTime')) {
				this.setPickerRangeUnitOfTime(options.unitOfTime);
			}
			if (options.hasOwnProperty('isLockDatePicker')) {
				this.setPickerLockingUnit(options.isLockDatePicker);
			}
		}
	}

	setPickerRangeUnitOfTime(unit: moment.unitOfTime.Base): void {
        this._pickerRangeUnitOfTime$.next(unit);
	}

	setPickerLockingUnit(isLockUnit: boolean) {
		this._isLockDatePickerUnit$.next(isLockUnit);
	}
}
