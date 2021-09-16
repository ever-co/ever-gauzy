import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	ProductTypesIconsEnum,
	LanguagesEnum,
	IProductTypeTranslation,
	IProductTypeTranslatable,
	IOrganization
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { distinctUntilChange } from '@gauzy/common-angular';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import {
	ProductTypeService,
	Store
} from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-type-mutation',
	templateUrl: './product-type-mutation.component.html',
	styleUrls: ['./product-type-mutation.component.scss']
})
export class ProductTypeMutationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	@Input() productType: IProductTypeTranslatable;

	icons = Object.values(ProductTypesIconsEnum);
	selectedLanguage: LanguagesEnum;
	activeTranslation: IProductTypeTranslation;
	translations: any = [];
	organization: IOrganization;

	readonly form: FormGroup = ProductTypeMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: ['', Validators.required],
			icon: [ProductTypesIconsEnum.STAR],
			description: []
		});
	}

	constructor(
		public readonly dialogRef: NbDialogRef<IProductTypeTranslatable>,
		public readonly translationService: TranslateService,
		private readonly fb: FormBuilder,
		private readonly productTypeService: ProductTypeService,
		private readonly store: Store
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

	ngOnDestroy(): void { }

	async onSubmit() {
		if (!this.organization) {
			return;
		}

		await this._setTranslationsRawValue();

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { translations = [] } = this;
		const { icon } = this.form.getRawValue();

		const payload: IProductTypeTranslatable = {
			organizationId,
			tenantId,
			translations,
			icon
		};
		
		let productType: IProductTypeTranslatable;
		try {
			if (!this.productType) {
				productType = await this.productTypeService.create(
					payload
				);
			} else {
				payload['id'] = this.productType.id;
				productType = await this.productTypeService.update(
					payload
				);
			}
		} catch (err) {
			console.log(err, typeof err);
		}

		this.closeDialog(productType);
	}

	async closeDialog(productType?: IProductTypeTranslatable) {
		this.dialogRef.close(productType);
	}

	/**
	 * PATCH product category old raw value
	 * 
	 * @returns 
	 */
	 private _patchRawValue() {
		if (!this.productType) {
			return;
		}

		const { icon, translations = [] } = this.productType;

		this.translations = translations;
		this.form.patchValue({ icon });

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
}
