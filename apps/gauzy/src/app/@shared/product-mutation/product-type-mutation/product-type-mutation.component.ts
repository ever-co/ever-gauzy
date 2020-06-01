import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	ProductTypesIconsEnum,
	LanguagesEnum,
	ProductTypeTranslation,
	ProductTypeTranslatable
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from '../../../@core/services/product-type.service';
import { NbDialogRef } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ngx-product-type-mutation',
	templateUrl: './product-type-mutation.component.html',
	styleUrls: ['./product-type-mutation.component.scss']
})
export class ProductTypeMutationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	form: FormGroup;
	@Input() productType: ProductTypeTranslatable;
	icons = Object.values(ProductTypesIconsEnum);

	selectedIcon: string = ProductTypesIconsEnum.STAR;
	selectedLanguage: string;
	languages: Array<string>;
	private _ngDestroy$ = new Subject<void>();

	translations = [];
	activeTranslation: ProductTypeTranslation;

	constructor(
		public dialogRef: NbDialogRef<ProductTypeTranslatable>,
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private productTypeService: ProductTypeService,
		private store: Store
	) {
		super(translationService);
	}
	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	ngOnInit() {
		this.selectedLanguage =
			this.store.preferredLanguage || LanguagesEnum.ENGLISH;
		this.translations = this.productType
			? this.productType.translations
			: [];
		this.setActiveTranslation();

		this._initializeForm();
		this.languages = this.translateService.getLangs();

		this.form.valueChanges
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((formValue) => {
				this.updateTranslations();
			});
	}

	async onSaveRequest() {
		const productTypeRequest = {
			organization: this.store.selectedOrganization,
			icon: this.selectedIcon,
			translations: this.translations
		};

		let productType: ProductTypeTranslatable;

		try {
			if (!this.productType) {
				productType = await this.productTypeService.create(
					productTypeRequest
				);
			} else {
				productTypeRequest['id'] = this.productType.id;
				productType = await this.productTypeService.update(
					productTypeRequest
				);
			}
		} catch (err) {
			console.log(err, typeof err);
		}

		this.closeDialog(productType);
	}

	async closeDialog(productType?: ProductTypeTranslatable) {
		this.dialogRef.close(productType);
	}

	private _initializeForm() {
		this.form = this.fb.group({
			languageCode: [this.translateService.currentLang],
			organizationId: [
				this.productType
					? this.productType.organizationId
					: this.store.selectedOrganization,
				Validators.required
			],
			name: [
				this.activeTranslation ? this.activeTranslation['name'] : '',
				Validators.required
			],
			description: [
				this.activeTranslation
					? this.activeTranslation['description']
					: null
			]
		});
	}

	setActiveTranslation() {
		this.activeTranslation = this.translations.find((tr) => {
			return tr.languageCode === this.selectedLanguage;
		});

		if (!this.activeTranslation) {
			this.activeTranslation = {
				languageCode: this.selectedLanguage,
				name: '',
				description: ''
			};

			this.translations.push(this.activeTranslation);
		}
	}

	onLangChange(langCode: string) {
		this.selectedLanguage = langCode;
		this.setActiveTranslation();

		this.form.patchValue({
			name: this.activeTranslation.name,
			description: this.activeTranslation.description
		});
	}

	updateTranslations() {
		this.activeTranslation.name = this.form.get('name').value;
		this.activeTranslation.description = this.form.get('description').value;
	}
}
