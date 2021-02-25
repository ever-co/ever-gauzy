import { Component, OnInit } from '@angular/core';
import {
	IProductOption,
	IProductOptionGroupTranslatable,
	LanguagesEnum,
	IProductOptionTranslatable
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { InventoryStore } from 'apps/gauzy/src/app/@core/services/inventory-store.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';

export interface OptionCreateInput {
	name: string;
	code: string;
}

export enum OptionLevel {
	SINGLE = 'SINGLE',
	GROUP = 'GROUP'
}

export interface IProductOptionGroupUI extends IProductOptionGroupTranslatable {
	stored?: boolean;
	formOptionGroupId?: string;
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

	activeOptionGroup: IProductOptionGroupUI | any = null;
	activeOption: IProductOptionTranslatable | any = {};

	activeLanguageCode: string = LanguagesEnum.ENGLISH;

	form: FormGroup;

	//tstodo test option groups
	optionGroups: any[] = [
		{
			formOptionGroupId: 0,
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
					name: 'green bg',
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
				{ languageCode: LanguagesEnum.BULGARIAN, name: 'color bg' }
			]
		},
		{
			formOptionGroupId: 1,
			name: 'size bg',
			options: [
				{
					name: 'large bg',
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
					name: 'small bg',
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
				{ languageCode: LanguagesEnum.BULGARIAN, name: 'size bg' }
			]
		}
	];

	constructor(
		private inventoryStore: InventoryStore,
		private fb: FormBuilder,
		private store: Store,
		private translateService: TranslateService
	) {}

	async ngOnInit() {
		this.initForm();

		this.form.controls['activeOptionGroupName'].valueChanges
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe((value) => {
				this.updateActiveOptionGroupName(value);
			});

		this.form.controls['activeOptionName'].valueChanges
			.pipe(untilDestroyed(this))
			.subscribe((value) => {
				console.log(value, ' value option name');
				this.updateActiveOptionName(value);
			});

		this.form.controls['activeOptionCode'].valueChanges
			.pipe(untilDestroyed(this))
			.subscribe((value) => {
				this.updateActiveOptionCode(value);
			});

		// this.inventoryStore.activeProduct$
		// 	.pipe(untilDestroyed(this))
		// 	.subscribe((activeProduct) => {

		// 	});

		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe((language) => {
				this.activeLanguageCode = language.lang;
				this.resetActiveTranslations();
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

	onCreateOptionGroupClick() {
		let newOptionGroup = this.getEmptyOptionGroup();
		this.activeOptionGroup = newOptionGroup;
		this.activeOption = {};
		this.optionGroups.splice(0, 0, newOptionGroup);
	}

	onCreateOptionClick() {
		if (!this.activeOptionGroup) return;

		let formValue = this.form.value;

		let newOption = {
			name: formValue['activeOptionName'],
			code: formValue['activeOptionCode'],
			translations: [
				{
					name: formValue['activeOptionName'],
					languageCode:
						this.activeLanguageCode || LanguagesEnum.ENGLISH,
					description: ''
				}
			]
		};
		this.activeOptionGroup.options.splice(0, 0, newOption);
		this.activeOption = {};
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
		} else {
			this.form.controls['activeOptionGroupName'].setErrors(null);
		}

		//tstodo or in the store
		this.activeOptionGroup.name = value;
		this.updateTranslationProperty(
			this.activeOptionGroup,
			'name',
			OptionLevel.GROUP,
			value
		);
	}

	updateActiveOptionName(value: string) {
		let checkDublicateOption = this.activeOptionGroup.options.find(
			(option) => option.name == value
		);

		if (checkDublicateOption) {
			this.form.controls['activeOptionName'].setErrors({
				error: 'dublicate option'
			});
		} else {
			this.form.controls['activeOptionName'].setErrors(null);
		}

		this.activeOption.name = value;
		this.updateTranslationProperty(
			this.activeOption,
			'name',
			OptionLevel.SINGLE,
			value
		);
	}

	updateActiveOptionCode(value: string) {
		let checkDublicateCode = this.activeOptionGroup.options.find(
			(option) => option.code == value
		);

		if (checkDublicateCode) {
			this.form.controls['activeOptionCode'].setErrors({
				error: 'dublicate code'
			});
		} else {
			this.form.controls['activeOptionCode'].setErrors(null);
		}

		this.activeOption.code = value;
		this.updateTranslationProperty(
			this.activeOption,
			'code',
			OptionLevel.SINGLE,
			value
		);
	}

	updateTranslationProperty(
		el: IProductOptionTranslatable | IProductOptionGroupTranslatable,
		property: string,
		optionLevel: OptionLevel,
		value?: string
	) {
		if (!el.translations) return;

		let translation: any = el.translations.find(
			(translation) => translation.languageCode == this.activeLanguageCode
		);

		if (!translation) {
			switch (optionLevel) {
				case OptionLevel.GROUP:
					translation = {
						languageCode: this.activeLanguageCode,
						name: '',
						description: ''
					};
					break;
				case OptionLevel.SINGLE:
					translation = {
						languageCode: this.activeLanguageCode,
						name: ''
					};
					break;
			}

			el.translations.push(translation);
		}

		if (value) {
			translation[property] = value;
		}
		el[property] = translation[property];

		//tstodo
		console.log(this.optionGroups, 'option group on update translation');
	}

	resetActiveTranslations() {
		this.optionGroups.forEach((group: IProductOptionGroupTranslatable) => {
			this.updateTranslationProperty(group, 'name', OptionLevel.GROUP);
			this.updateTranslationProperty(
				group,
				'description',
				OptionLevel.GROUP
			);

			group.options.forEach((option: IProductOptionTranslatable) => {
				this.updateTranslationProperty(
					option,
					'name',
					OptionLevel.SINGLE
				);
			});
		});
	}

	isActive(productOptionGroupInput: IProductOptionGroupTranslatable | any) {
		if (!productOptionGroupInput || !this.activeOptionGroup) return false;

		return (
			productOptionGroupInput.formOptionGroupId ==
			this.activeOptionGroup.formOptionGroupId
		);
	}

	setActiveOptionGroup(
		productOptionGroupInput: IProductOptionGroupTranslatable
	) {
		this.activeOptionGroup = productOptionGroupInput;
		this.activeOption = this.getEmptyOption();
		this.updateFormValue();
	}

	setActiveOption(productOption: IProductOptionTranslatable) {
		this.activeOption = productOption;
		this.updateFormValue();
	}

	private initForm() {
		this.form = this.fb.group({
			activeOptionGroupName: [''],
			activeOptionName: [''],
			activeOptionCode: ['']
		});
	}

	resetFormValue() {
		this.form.patchValue({
			activeOptionGroupName: '',
			activeOptionName: '',
			activeOptionCode: ''
		});
	}

	updateFormValue() {
		if (!this.activeOptionGroup || !this.activeOption) return;

		this.form.patchValue({
			activeOptionGroupName: this.activeOptionGroup.name,
			activeOptionName: this.activeOption.name,
			activeOptionCode: this.activeOption.code
		});
	}

	getEmptyOption() {
		return {
			name: '',
			code: '',
			translations: [
				{
					name: '',
					languageCode: this.activeLanguageCode,
					description: ''
				}
			]
		};
	}

	generateOptionGroupFormId() {
		return this.optionGroups.length;
	}

	getEmptyOptionGroup = () => {
		return {
			name: 'new option group',
			options: [],
			translations: [],
			formOptionGroupId: this.generateOptionGroupFormId()
		};
	};
}
