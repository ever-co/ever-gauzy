import { Component, OnInit, ViewChild } from '@angular/core';
import {
	IProductOption,
	IProductOptionGroupTranslatable,
	LanguagesEnum,
	IProductOptionTranslatable
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { InventoryStore } from 'apps/gauzy/src/app/@core/services/inventory-store.service';
import { NgForm, FormGroup, FormBuilder } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { resolve } from 'dns';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

export interface OptionCreateInput {
	name: string;
	code: string;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-options-form',
	templateUrl: './options-form.component.html',
	styleUrls: ['./options-form.component.scss']
})
export class OptionsFormComponent implements OnInit {
	editOption: IProductOption;
	// activeOption: IProductOption;
	activeOptionName: string;
	optionMode = 'create';

	options: IProductOption[] = [];

	activeOptionGroup: IProductOptionGroupTranslatable = null;
	activeOption: IProductOptionTranslatable = null;

	form: FormGroup;

	//tstodo test option groups
	optionGroups: IProductOptionGroupTranslatable[] = [
		{
			name: 'color bg',
			options: [
				{
					name: 'red bg',
					code: '',
					translations: [
						{
							name: 'red bg',
							languageCode: LanguagesEnum.BULGARIAN,
							description: 'description bg'
						}
					]
				},
				{
					name: 'red bg',
					code: '',
					translations: [
						{
							name: 'green bg',
							languageCode: LanguagesEnum.BULGARIAN,
							description: 'description bg'
						}
					]
				}
			],
			translations: [
				{ languageCode: LanguagesEnum.ENGLISH, name: 'color bg' }
			]
		},
		{
			name: 'size bg',
			options: [
				{
					name: 'red bg',
					code: '',
					translations: [
						{
							name: 'large bg',
							languageCode: LanguagesEnum.BULGARIAN,
							description: 'description bg'
						}
					]
				},
				{
					name: 'red bg',
					code: '',
					translations: [
						{
							name: 'small bg',
							languageCode: LanguagesEnum.BULGARIAN,
							description: 'description bg'
						}
					]
				}
			],
			translations: [
				{ languageCode: LanguagesEnum.ENGLISH, name: 'size bg' }
			]
		}
	];

	constructor(
		private inventoryStore: InventoryStore,
		private fb: FormBuilder,
		private store: Store
	) {}

	async ngOnInit() {
		this.initForm();

		this.form
			.get('activeOptionGroupName')
			.valueChanges.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe((value) => {
				this.updateActiveOptionGroupName(value);
				console.log(this.optionGroups, ' this option groups');
			});

		this.form
			.get('activeOptionName')
			.valueChanges.pipe(untilDestroyed(this))
			.subscribe((value) => {
				console.log(value, ' active option  name');
			});

		this.form
			.get('activeOptionCode')
			.valueChanges.pipe(untilDestroyed(this))
			.subscribe((value) => {
				console.log(value, ' active option code');
			});

		this.inventoryStore.activeProduct$
			.pipe(untilDestroyed(this))
			.subscribe((activeProduct) => {
				//tstodo
				// this.options = activeProduct.options;
			});

		this.store.preferredLanguage$
			.pipe(untilDestroyed(this))
			.subscribe((language) => {
				//tstodo
				console.log(language, ' language');
			});
	}

	onSaveOption() {
		if (!(this.activeOption.name && this.activeOption.code)) return;

		// if (this.optionMode == 'create') {
		// 	this.inventoryStore.createOption(this.activeOption);
		// } else {
		// 	this.inventoryStore.updateOption(
		// 		this.editOption,
		// 		this.activeOption
		// 	);
		// }

		this.resetOptionForm();
	}

	onRemoveOption(optionInput: IProductOption) {
		if (!optionInput) return;

		this.options = this.options.filter(
			(option) => option.name !== optionInput.name
		);

		this.inventoryStore.deleteOption(optionInput);
		this.resetOptionForm();
	}

	resetOptionForm() {}

	onEditOption(option: IProductOption) {
		this.editOption = option;
		this.optionMode = 'edit';
	}

	updateActiveOptionGroupName(value: string) {
		if (
			this.optionGroups.find((optionGroup) => optionGroup.name == value)
		) {
			this.form.controls['activeOptionGroupName'].setErrors({
				error: 'alredy group'
			});

			return;
		}

		//or in the store
		this.activeOptionGroup.name = value;
	}

	isActive(productOptionGroupInput: IProductOptionGroupTranslatable) {
		if (!productOptionGroupInput || !this.activeOptionGroup) return;
		return productOptionGroupInput.name == this.activeOptionGroup.name;
	}

	setActiveOptionGroup(
		productOptionGroupInput: IProductOptionGroupTranslatable
	) {
		this.activeOptionGroup = productOptionGroupInput;
	}

	onActiveOptionGroupNameChange(input: string) {}

	private initForm() {
		this.form = this.fb.group({
			activeOptionGroupName: [''],
			activeOptionName: [''],
			activeOptionCode: ['']
		});
	}
}
