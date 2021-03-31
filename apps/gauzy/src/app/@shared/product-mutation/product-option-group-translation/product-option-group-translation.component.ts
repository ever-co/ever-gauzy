import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, Input, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import {
	IProductCategoryTranslatable,
	IProductOptionGroupTranslatable
} from '@gauzy/contracts';

import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { ProductCategoryService } from '../../../@core/services/product-category.service';
import { Store } from '../../../@core/services/store.service';
import { ToastrService } from '../../../@core/services/toastr.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export enum RowType {}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-option-group-translation',
	templateUrl: './product-option-group-translation.component.html',
	styleUrls: ['./product-option-group-translation.component.scss']
})
export class ProductOptionGroupTranslationsComponent extends TranslationBaseComponent {
	form: FormGroup;
	@Input() productOptionGroup: IProductOptionGroupTranslatable;
	languages: any[] = [];
	activeGroupValueLng: string = '';
	activeOptionValueLng: string = '';
	activeOption = null;

	constructor(
		public dialogRef: NbDialogRef<IProductCategoryTranslatable>,
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private productCategoryService: ProductCategoryService,
		private store: Store,
		private toastrService: ToastrService
	) {
		super(translationService);
	}

	ngOnInit() {
		this.languages = this.store.systemLanguages.map((item) => {
			return {
				value: item.code,
				name: item.name
			};
		});

		let formControls = {};
		this.languages.forEach((ln) => {
			formControls[ln.value] = [''];
		});

		this.form = this.fb.group({
			...formControls
		});

		this.languages.forEach((lg) => {
			this.form.controls[lg.value].valueChanges
				.pipe(
					untilDestroyed(this),
					debounceTime(500),
					distinctUntilChanged()
				)
				.subscribe((value) => {
					let groupTranslation = this.productOptionGroup.translations.find(
						(tr) => {
							return tr.languageCode == lg.value;
						}
					);

					let optionTranslation = this.activeOption
						? this.activeOption.translations.find(
								(tr) => tr.languageCode == lg.value
						  )
						: '';

					if (groupTranslation && this.activeGroupValueLng) {
						groupTranslation.name = value;
					} else if (optionTranslation && this.activeOptionValueLng) {
						optionTranslation.name = value;
					}
				});
		});
	}

	getGroupTitleTranslation(languageCodeInput: string) {
		let translation = this.productOptionGroup.translations.find(
			(tr) => tr.languageCode == languageCodeInput
		);

		if (translation) {
			return translation.name;
		} else {
			this.productOptionGroup.translations.push({
				languageCode: languageCodeInput,
				name: '',
				reference: this.productOptionGroup
			});
		}
	}

	getOptionNameTranslation(option, languageCodeInput: string) {
		let translation = option.translations.find(
			(tr) => tr.languageCode == languageCodeInput
		);

		if (translation) {
			return translation.name;
		} else {
			option.translations.push({
				languageCode: languageCodeInput,
				name: '',
				reference: option
			});
		}
	}

	setActiveGroupValueLngCode(languageCode: string) {
		this.form.get(languageCode).setValue('');
		this.activeGroupValueLng = languageCode;
		this.activeOptionValueLng = '';

		let newtr = this.productOptionGroup.translations.find(
			(tr) => tr.languageCode == languageCode
		);

		if (newtr && newtr.name) {
			this.form.get(languageCode).setValue(newtr.name);
		}
	}

	unSetActiveGroupValueLngCode() {
		this.activeGroupValueLng = '';
	}

	isOptionGroupValueActive(languageCode: string) {
		return languageCode == this.activeGroupValueLng;
	}

	setActiveOptionLngCode(option, languageCode: string) {
		this.form.get(languageCode).setValue('');
		this.activeOptionValueLng = languageCode;
		this.activeOption = option;
		this.activeGroupValueLng = '';
		let newtr = option.translations.find(
			(tr) => tr.languageCode == languageCode
		);

		if (newtr && newtr.name) {
			this.form.get(languageCode).setValue(newtr.name);
		}
	}

	unSetActiveOptionLngCode() {
		this.activeOptionValueLng = '';
		this.activeOption = null;
	}

	isOptionActive(option, languageCode: string) {
		if (
			!option ||
			!option.id ||
			!this.activeOption ||
			!this.activeOption.id
		)
			return;

		return (
			this.activeOption.id == option.id &&
			languageCode == this.activeOptionValueLng
		);
	}

	async onSaveRequest() {
		this.dialogRef.close(this.productOptionGroup);
	}
}
