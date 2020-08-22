import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
	KeyResultTypeEnum,
	CurrenciesEnum,
	KeyResultNumberUnitsEnum
} from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-goal-custom-unit-select',
	templateUrl: './goal-custom-unit-select.component.html',
	styleUrls: ['./goal-custom-unit-select.component.scss']
})
export class GoalCustomUnitSelectComponent implements OnInit, OnDestroy {
	@Input() parentFormGroup: FormGroup;
	@Input() numberUnits: string[];
	keyResultTypeEnum = KeyResultTypeEnum;
	currenciesEnum = CurrenciesEnum;
	createNew = false;
	private _ngDestroy$ = new Subject<void>();
	constructor() {}

	ngOnInit() {
		this.parentFormGroup.controls['type'].valueChanges
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((formValue) => {
				if (formValue === KeyResultTypeEnum.CURRENCY) {
					this.parentFormGroup.controls['unit'].patchValue(
						CurrenciesEnum.BGN
					);
				} else if (formValue === KeyResultTypeEnum.NUMERICAL) {
					this.parentFormGroup.controls['unit'].patchValue(
						KeyResultNumberUnitsEnum.ITEMS
					);
				}
			});
	}

	createNewUnit() {
		if (this.parentFormGroup.value.unit !== ' ') {
			this.numberUnits.push(this.parentFormGroup.value.unit);
		}
		this.createNew = false;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
