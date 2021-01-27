import {
	Component,
	Input,
	Output,
	EventEmitter,
	OnInit,
	OnChanges,
	SimpleChanges
} from '@angular/core';
import { IProductOption } from '@gauzy/contracts';
import { Router } from '@angular/router';

export interface OptionCreateInput {
	name: string;
	code: string;
}

export interface VariantCreateInput {
	options: string[];
	isStored: boolean;
	id?: string;
	productId?: string;
}

@Component({
	selector: 'ngx-variant-form',
	templateUrl: './variant-form.component.html',
	styleUrls: ['./variant-form.component.scss']
})
export class VariantFormComponent implements OnInit, OnChanges {
	@Input() options: IProductOption[];
	@Input() variantsDb: VariantCreateInput[];
	@Output() variantCreateInputsUpdated = new EventEmitter<
		VariantCreateInput[]
	>();

	variantCreateInputs: VariantCreateInput[] = [];
	editVariantCreateInput: VariantCreateInput = {
		options: [],
		isStored: false
	};
	mode = 'create';

	constructor(private router: Router) {}

	ngOnInit(): void {
		if (this.variantsDb) {
			this.variantCreateInputs = this.variantsDb;
		}
	}

	ngOnChanges(changesInput: SimpleChanges): void {
		const { currentValue } = changesInput.variantsDb || {};

		if (currentValue) {
			this.variantCreateInputs = currentValue;
		}
	}

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

		let variantCreateInputs = this.variantCreateInputs.filter(
			(variantCreateInput) => !variantCreateInput.isStored
		);

		//tstodo same for update
		this.variantCreateInputsUpdated.emit(variantCreateInputs);
		this.resetCreateVariantInputForm();
	}

	resetCreateVariantInputForm() {
		this.mode = 'create';
		this.editVariantCreateInput = { options: [], isStored: false };
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

	onVariantBtnClick(variantCreateInput: VariantCreateInput) {
		const { id, productId } = variantCreateInput;

		if (productId && id) {
			this.router.navigate([
				`/pages/organization/inventory/${productId}/variants/${id}`
			]);
		}
	}
}
