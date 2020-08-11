import { Component, OnInit, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { KeyResultTypeEnum, CurrenciesEnum } from '@gauzy/models';

@Component({
	selector: 'ga-goal-custom-unit-select',
	templateUrl: './goal-custom-unit-select.component.html',
	styleUrls: ['./goal-custom-unit-select.component.scss']
})
export class GoalCustomUnitSelectComponent implements OnInit {
	@Input() parentFormGroup: FormGroup;
	@Input() numberUnits: string[];
	keyResultTypeEnum = KeyResultTypeEnum;
	currenciesEnum = CurrenciesEnum;
	createNew = false;
	constructor() {}

	ngOnInit(): void {}

	createNewUnit() {
		if (this.parentFormGroup.value.unit !== ' ') {
			this.numberUnits.push(this.parentFormGroup.value.unit);
		}
		this.createNew = false;
	}
}
