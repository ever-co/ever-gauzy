import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ProductOption } from '@gauzy/models';

export interface OptionCreateInput {
	name: string;
	code: string;
}

export interface VariantCreateInput {
	options: string[];
}

@Component({
	selector: 'ngx-variant-form',
	templateUrl: './variant-form.component.html',
	styleUrls: ['./variant-form.component.scss']
})
export class VariantFormComponent {
	@Input() options: ProductOption[];
	@Output() variantCreateInputsUpdated = new EventEmitter<
		VariantCreateInput[]
	>();

	variantCreateInputs: VariantCreateInput[] = [];
	editVariantCreateInput: VariantCreateInput = { options: [] };
	mode = 'create';

	onSelectOption(selectedOptions: string[]) {
		this.editVariantCreateInput.options = selectedOptions;

		if (selectedOptions.length === 0) {
			this.variantCreateInputs = this.variantCreateInputs.filter(
				(variant) => variant.options.length > 0
			);
			this.resetCreateVariantInputForm();
		}
	}

	onEditProductVariant(variantCreateInput: VariantCreateInput) {
		this.editVariantCreateInput = variantCreateInput;
		this.mode = 'edit';
	}

	onSaveVariant() {
		if (
			this.mode === 'create' &&
			!this.optionCombinationAlreadySelected()
		) {
			this.variantCreateInputs.push(this.editVariantCreateInput);
		}

		this.variantCreateInputsUpdated.emit(this.variantCreateInputs);
		this.resetCreateVariantInputForm();
	}

	resetCreateVariantInputForm() {
		this.mode = 'create';
		this.editVariantCreateInput = { options: [] };
	}

	optionCombinationAlreadySelected() {
		let result = false;

		this.variantCreateInputs.forEach((variant) => {
			const check = this.editVariantCreateInput.options.every(
				(elemCheck) => {
					return (
						variant.options.indexOf(elemCheck) > -1 &&
						variant.options.length ===
							this.editVariantCreateInput.options.length
					);
				}
			);

			if (check) result = true;
		});

		return result;
	}

	getVariantDisplayName(variantCreateInput: VariantCreateInput) {
		return variantCreateInput.options.join(' ');
	}
}
