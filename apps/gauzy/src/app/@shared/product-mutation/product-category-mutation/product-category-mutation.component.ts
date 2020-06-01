import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	ProductCategoryTranslatable,
	ProductCategoryTranslation,
	LanguagesEnum
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { ProductCategoryService } from '../../../@core/services/product-category.service';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ToastrService } from '../../../@core/services/toastr.service';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ngx-product-type-mutation',
	templateUrl: './product-category-mutation.component.html',
	styleUrls: ['./product-category-mutation.component.scss']
})
export class ProductCategoryMutationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private ngDestroy$ = new Subject<void>();

	form: FormGroup;
	@Input() productCategory: ProductCategoryTranslatable;
	selectedLanguage: string;

	hoverState: boolean;

	private _ngDestroy$ = new Subject<void>();

	languages: Array<string>;
	translations = [];
	activeTranslation: ProductCategoryTranslation;

	constructor(
		public dialogRef: NbDialogRef<ProductCategoryTranslatable>,
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private productCategoryService: ProductCategoryService,
		private store: Store,
		private toastrService: ToastrService
	) {
		super(translationService);
	}

	ngOnInit() {
		this.selectedLanguage =
			this.store.preferredLanguage || LanguagesEnum.ENGLISH;
		this.translations = this.productCategory
			? this.productCategory.translations
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
		const productCategoryRequest = {
			organization: this.store.selectedOrganization,
			imageUrl: this.form.get('imageUrl').value,
			translations: this.translations
		};

		let productCategory: ProductCategoryTranslatable;

		if (!this.productCategory) {
			productCategory = await this.productCategoryService.create(
				productCategoryRequest
			);
		} else {
			productCategoryRequest['id'] = this.productCategory.id;
			productCategory = await this.productCategoryService.update(
				productCategoryRequest
			);
		}

		this.closeDialog(productCategory);
	}

	async closeDialog(productCategory?: ProductCategoryTranslatable) {
		this.dialogRef.close(productCategory);
	}

	private _initializeForm() {
		this.form = this.fb.group({
			organizationId: [
				this.productCategory
					? this.productCategory.organizationId
					: this.store.selectedOrganization$,
				Validators.required
			],
			name: [
				this.activeTranslation ? this.activeTranslation['name'] : '',
				Validators.required
			],
			imageUrl: [
				this.productCategory ? this.productCategory.imageUrl : null
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

	handleImageUploadError(error: any) {
		this.toastrService.danger(
			error.error.message || error.message,
			'Error'
		);
	}

	ngOnDestroy(): void {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}
