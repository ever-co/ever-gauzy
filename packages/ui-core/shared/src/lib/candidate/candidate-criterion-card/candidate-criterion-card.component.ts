import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AbstractControl, UntypedFormGroup } from '@angular/forms';

export interface ICandidateCriterionCardItem {
	id?: string;
	name: string;
}

/**
 * Presentational card shared by the technology stack and personal qualities criterions:
 * a titled panel with the name input, its actions, clashing names and the saved criterions.
 */
@Component({
	selector: 'ga-candidate-criterion-card',
	templateUrl: './candidate-criterion-card.component.html',
	styleUrls: ['./candidate-criterion-card.component.scss'],
	standalone: false
})
export class CandidateCriterionCardComponent {
	@Input() icon: string;
	@Input() heading: string;
	@Input() placeholder: string;
	@Input() emptyText: string;
	/** Form group holding the `name` control of the criterion being added or edited */
	@Input() group: AbstractControl;
	@Input() items: ICandidateCriterionCardItem[] = [];
	@Input() existedNames: string[] = [];
	@Input() showCancel = false;

	@Output() readonly save = new EventEmitter<void>();
	@Output() readonly cancelEdit = new EventEmitter<void>();
	@Output() readonly editItem = new EventEmitter<{ index: number; id: string }>();
	@Output() readonly removeItem = new EventEmitter<ICandidateCriterionCardItem>();

	get formGroup(): UntypedFormGroup {
		return this.group as UntypedFormGroup;
	}
}
