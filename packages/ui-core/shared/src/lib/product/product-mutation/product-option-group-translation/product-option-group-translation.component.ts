import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Component, Input } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { IProductCategoryTranslatable, IProductOptionGroupTranslatable } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { Store } from '@gauzy/ui-core/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-product-option-group-translation',
    templateUrl: './product-option-group-translation.component.html',
    styleUrls: ['./product-option-group-translation.component.scss'],
    standalone: false
})
export class ProductOptionGroupTranslationsComponent extends TranslationBaseComponent {
	form: UntypedFormGroup;
	@Input() productOptionGroup: IProductOptionGroupTranslatable;
	languages: any[] = [];
	activeGroupValueLng: string = '';
	activeOptionValueLng: string = '';
	activeOption = null;

	constructor(
		public dialogRef: NbDialogRef<IProductCategoryTranslatable>,
		readonly translationService: TranslateService,
		private fb: UntypedFormBuilder,
		private store: Store
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
				.pipe(untilDestroyed(this), debounceTime(100), distinctUntilChanged())
				.subscribe((value) => {
					let groupTranslation = this.productOptionGroup.translations.find((tr) => {
						return tr.languageCode == lg.value;
					});

					let optionTranslation = this.activeOption
						? this.activeOption.translations.find((tr) => tr.languageCode == lg.value)
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
		let translation = this.productOptionGroup.translations.find((tr) => tr.languageCode == languageCodeInput);

		if (translation) {
			return translation.name;
		} else {
			this.productOptionGroup.translations.push({
				languageCode: languageCodeInput,
				name: ''
			});
		}
	}

	getOptionNameTranslation(option, languageCodeInput: string) {
		let translation = option.translations.find((tr) => tr.languageCode == languageCodeInput);

		if (translation) {
			return translation.name;
		} else {
			option.translations.push({
				languageCode: languageCodeInput,
				name: ''
			});
		}
	}

	setActiveGroupValueLngCode(languageCode: string) {
		this.form.get(languageCode).setValue('');
		this.activeGroupValueLng = languageCode;
		this.activeOptionValueLng = '';

		let newTranslation = this.productOptionGroup.translations.find((tr) => tr.languageCode == languageCode);

		if (newTranslation && newTranslation.name) {
			this.form.get(languageCode).setValue(newTranslation.name);
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
		let newTranslation = option.translations.find((tr) => tr.languageCode == languageCode);

		if (newTranslation && newTranslation.name) {
			this.form.get(languageCode).setValue(newTranslation.name);
		}
	}

	unSetActiveOptionLngCode() {
		this.activeOptionValueLng = '';
		this.activeOption = null;
	}

	isOptionActive(option, languageCode: string) {
		if (!option || !this.activeOption) return;

		return this.activeOption.formOptionId == option.formOptionId && this.activeOptionValueLng == languageCode;
	}

	async onSaveRequest() {
		this.dialogRef.close(this.productOptionGroup);
	}
}
