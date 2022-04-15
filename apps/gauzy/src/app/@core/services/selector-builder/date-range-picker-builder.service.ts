import { Injectable } from '@angular/core';
import moment from 'moment';
import { isNotEmpty } from '@gauzy/common-angular';
import { BehaviorSubject, Observable } from 'rxjs';

export interface IDatePickerConfig {
	readonly unitOfTime: moment.unitOfTime.Base,
	readonly isLockDatePicker: boolean;
}

export const DEFAULT_DATE_PICKER_CONFIG: IDatePickerConfig = {
	unitOfTime: 'month',
	isLockDatePicker: false
};

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	private _pickerRangeUnitOfTime$: BehaviorSubject<moment.unitOfTime.Base> = new BehaviorSubject(DEFAULT_DATE_PICKER_CONFIG.unitOfTime);
	public pickerRangeUnitOfTime$: Observable<moment.unitOfTime.Base> = this._pickerRangeUnitOfTime$.asObservable();

	private _isLockDatePickerUnit$: BehaviorSubject<boolean> = new BehaviorSubject(DEFAULT_DATE_PICKER_CONFIG.isLockDatePicker);
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
