import { Component, OnInit } from '@angular/core';
import { IProductOption } from '@gauzy/contracts';
import { Router } from '@angular/router';
import { InventoryStore } from 'apps/gauzy/src/app/@core/services/inventory-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
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

@UntilDestroy()
@Component({
	selector: 'ngx-variant-form',
	templateUrl: './variant-form.component.html',
	styleUrls: ['./variant-form.component.scss']
})
export class VariantFormComponent implements OnInit {
	options: IProductOption[];

	variantCreateInputs: VariantCreateInput[] = [];
	editVariantCreateInput: VariantCreateInput = {
		options: [],
		isStored: false
	};
	mode = 'create';

	constructor(
		private router: Router,
		private inventoryStore: InventoryStore
	) {}

	ngOnInit(): void {
		this.inventoryStore.activeProduct$
			.pipe(untilDestroyed(this))
			.subscribe((activeProduct) => {
				this.options = activeProduct.options;
			});

		this.inventoryStore.variantCreateInputs$
			.pipe(untilDestroyed(this))
			.subscribe((variantCreateInputs) => {
				this.variantCreateInputs = variantCreateInputs;
			});
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
			this.inventoryStore.addVariantCreateInput(
				this.editVariantCreateInput
			);
		} else {
		}

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

		if (!variantCreateInput.isStored) {
			this.onEditProductVariant(variantCreateInput);
			return;
		}

		if (productId && id) {
			this.router.navigate([
				`/pages/organization/inventory/${productId}/variants/${id}`
			]);
		}
	}
}
