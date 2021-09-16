import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	IOrganization,
	IProductCategoryTranslatable,
	IProductCategoryTranslation,
	LanguagesEnum
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { distinctUntilChange } from '@gauzy/common-angular';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import {
	ProductCategoryService,
	Store,
	ToastrService
} from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-category-mutation',
	templateUrl: './product-category-mutation.component.html',
	styleUrls: ['./product-category-mutation.component.scss']
})
export class ProductCategoryMutationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	@Input() productCategory: IProductCategoryTranslatable;

	hoverState: boolean;
	selectedLanguage: LanguagesEnum;
	activeTranslation: IProductCategoryTranslation;
	organization: IOrganization;
	translations: any = [];

	readonly form: FormGroup = ProductCategoryMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: ['', Validators.required],
			imageUrl: [],
			description: []
		});
	}

	constructor(
		public readonly dialogRef: NbDialogRef<IProductCategoryTranslatable>,
		public readonly translationService: TranslateService,
		private readonly fb: FormBuilder,
		private readonly productCategoryService: ProductCategoryService,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) {
		super(translationService);
	}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$;
		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				distinctUntilChange(),
				filter(([organization, language]) => !!organization && !!language),
				tap(([organization, language]) => {
					this.selectedLanguage = language || LanguagesEnum.ENGLISH;
					this.organization = organization;
				}),
				tap(() => this._patchRawValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async onSubmit() {
		if (!this.organization) {
			return;
		}
		await this._setTranslationsRawValue();

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { translations = [] } = this;
		const { imageUrl } = this.form.getRawValue();

		const payload: IProductCategoryTranslatable = {
			organizationId,
			tenantId,
			imageUrl,
			translations
		};

		let productCategory: IProductCategoryTranslatable;
		if (!this.productCategory) {
			productCategory = await this.productCategoryService.create(
				payload
			);
		} else {
			payload['id'] = this.productCategory.id;
			productCategory = await this.productCategoryService.update(
				payload
			);
		}
		this.closeDialog(productCategory);
	}

	async closeDialog(productCategory?: IProductCategoryTranslatable) {
		this.dialogRef.close(productCategory);
	}

	/**
	 * PATCH product category old raw value
	 * 
	 * @returns 
	 */
	private _patchRawValue() {
		if (!this.productCategory) {
			return;
		}

		const { imageUrl, translations = [] } = this.productCategory;

		this.translations = translations;
		this.form.patchValue({ imageUrl });

		this._setActiveTranslation();
	}

	/**
	 * SET selected language active translation
	 * 
	 * @returns 
	 */
	private _setActiveTranslation() {		
		this.activeTranslation = this.translations.find(({ languageCode }) => {
			return languageCode === this.selectedLanguage;
		});

		this.form.patchValue({
			name: this.activeTranslation ? this.activeTranslation.name : '',
			description: this.activeTranslation ? this.activeTranslation.description: ''
		});
	}

	/**
	 * SET product category all translations
	 */
	private async _setTranslationsRawValue() {
		const { name, description } = this.form.getRawValue();
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		// Remove old transaltions for language code
		const translations = this.translations.filter(({ languageCode }) => {
			return languageCode !== this.selectedLanguage;
		});

		// Added latest product category translations
		this.translations = [
			...translations,
			{
				name,
				description,
				tenantId,
				organizationId,
				languageCode: this.selectedLanguage
			}
		];
	}

	/**
	 * On language change set active translation
	 * 
	 * @param langCode 
	 */
	onLangChange(langCode: LanguagesEnum) {
		this.selectedLanguage = langCode;
		this._setActiveTranslation();
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error.error.message || error.message, 'TOASTR.TITLE.ERROR');
	}

	ngOnDestroy(): void { }
}
