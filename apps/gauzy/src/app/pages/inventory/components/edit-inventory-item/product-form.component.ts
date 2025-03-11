import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { UntypedFormGroup, UntypedFormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { NbTabComponent, NbTabsetComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ITag,
	IProductTypeTranslated,
	IProductCategoryTranslated,
	LanguagesEnum,
	IOrganization,
	IProductTranslation,
	IProductTranslatable
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { InventoryStore, ProductService, ProductVariantService, Store, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-form',
	templateUrl: './product-form.component.html',
	styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent extends TranslationBaseComponent implements OnInit {
	form: UntypedFormGroup;
	inventoryItem: IProductTranslatable;
	hoverState: boolean;
	selectedLanguage: string;
	translations = [];
	activeTranslation: IProductTranslation;
	tags: ITag[] = [];
	public organization: IOrganization;
	productId: string;

	@ViewChild('inventoryTabset') inventoryTabset: NbTabsetComponent;
	@ViewChild('mainTab') mainTab: NbTabComponent;
	@ViewChild('optionsTab') optionsTab: NbTabComponent;
	@ViewChild('variantsTab') variantsTab: NbTabComponent;

	constructor(
		public readonly translationService: TranslateService,
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly productService: ProductService,
		private readonly route: ActivatedRoute,
		private readonly location: Location,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly productVariantService: ProductVariantService,
		private readonly inventoryStore: InventoryStore
	) {
		super(translationService);
	}

	ngOnInit() {
		this.inventoryStore.clearCurrentProduct();
		this.setRouteSubscription();
		this.setOrganizationSubscription();
		this.setTranslationSettings();
	}

	private setRouteSubscription() {
		this.route.params.pipe(untilDestroyed(this)).subscribe(async (params) => {
			if (!params.id) {
				this.inventoryStore.clearCurrentProduct();
				return;
			} else if (params.id) {
				this.productId = params.id;
				this.loadProduct(this.productId);
			}
		});
	}

	private setOrganizationSubscription() {
		this.store.selectedOrganization$.pipe(untilDestroyed(this)).subscribe((organization: IOrganization) => {
			if (organization) {
				this.organization = organization;
				this.loadProduct(this.productId);
			}
		});
	}

	private _initializeForm() {
		this.form = this.fb.group({
			tags: [this.inventoryItem ? this.inventoryItem.tags : ''],
			name: [this.activeTranslation ? this.activeTranslation.name : '', this.validateTranslationProperty('name')],
			code: [this.inventoryItem ? this.inventoryItem.code : '', Validators.required],
			productTypeId: [this.inventoryItem ? this.inventoryItem.productTypeId : null, Validators.required],
			productType: [this.inventoryItem ? this.inventoryItem.productType : null],
			productCategoryId: [this.inventoryItem ? this.inventoryItem.productCategoryId : null, Validators.required],
			productCategory: [this.inventoryItem ? this.inventoryItem.productCategory : null],
			enabled: [this.inventoryItem ? this.inventoryItem.enabled : true],
			description: [this.activeTranslation ? this.activeTranslation.description : ''],
			languageCode: [this.translateService.currentLang, Validators.required]
		});
	}

	validateTranslationProperty =
		(propertyName: string) =>
		(control: AbstractControl): null | ValidationErrors => {
			return this.translations.every((translation: IProductTranslation) => {
				return !translation[propertyName] && !control.value;
			})
				? { required: true }
				: null;
		};

	async loadProduct(id: string) {
		if (id && this.organization) {
			const { id: organizationId, tenantId } = this.organization;
			this.inventoryItem = await this.productService.getById(
				id,
				['productCategory', 'productType', 'optionGroups', 'variants', 'tags', 'gallery', 'featuredImage'],
				{ organizationId, tenantId }
			);

			this.inventoryStore.activeProduct = this.inventoryItem;
		}

		this.tags = this.inventoryItem ? this.inventoryItem.tags : [];

		this.setTranslationSettings();
		this._initializeForm();

		this.form.patchValue({
			productCategory: this.inventoryItem ? this.inventoryItem.productCategory : null,
			productType: this.inventoryItem ? this.inventoryItem.productType : null
		});

		this.inventoryStore.initVariantCreateInputs();

		this.form.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
			this.updateTranslations();
		});
	}

	/**
	 * When product types selectors loaded in DOM
	 *
	 * @param productTypes
	 */
	onLoadProductTypes(productTypes: IProductTypeTranslated[]) {
		if (!this.inventoryStore.productTypesLoaded) {
			this.inventoryStore.productTypes = productTypes;
		}
	}

	/**
	 * When product type is selected in DOM
	 *
	 * @param productType
	 */
	selectedProductType(productType: IProductTypeTranslated) {
		this.form.get('productType').setValue(productType);
		this.form.get('productType').updateValueAndValidity();
	}

	/**
	 * When product categories selectors loaded in DOM
	 *
	 * @param productCategories
	 */
	onLoadProductCategories(productCategories: IProductCategoryTranslated[]) {
		if (!this.inventoryStore.productCategoriesLoaded) {
			this.inventoryStore.productCategories = productCategories;
		}
	}

	/**
	 * When product category is selected in DOM
	 *
	 * @param productCategory
	 */
	selectedProductCategory(productCategory: IProductCategoryTranslated) {
		this.form.get('productCategory').setValue(productCategory);
		this.form.get('productCategory').updateValueAndValidity();
	}

	async onSaveRequest() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const productRequest = {
			tags: this.form.get('tags').value,
			translations: this.translations,
			code: this.form.get('code').value,
			featuredImage: this.inventoryStore.featuredImage || null,
			productTypeId: this.form.get('productTypeId').value,
			productCategoryId: this.form.get('productCategoryId').value,
			enabled: this.form.get('enabled').value,
			optionGroupUpdateInputs: this.inventoryStore.updateOptionGroups,
			optionGroupCreateInputs: this.inventoryStore.createOptionGroups,
			optionGroupDeleteInputs: this.inventoryStore.deletedOptionGroups,
			optionDeleteInputs: this.inventoryStore.deleteOptions,
			gallery: this.inventoryStore.gallery || [],
			category: this.form.get('productCategory').value,
			type: this.form.get('productType').value,
			tenantId: tenantId,
			organizationId: organizationId
		};

		if (this.inventoryItem) {
			productRequest['id'] = this.inventoryItem.id;
		}

		try {
			let productResult: IProductTranslatable;

			if (!productRequest['id']) {
				productResult = await this.productService.create(productRequest);
			} else {
				productResult = await this.productService.update(productRequest);
			}

			await this.productVariantService.createProductVariants({
				product: productResult,
				optionCombinations: this.inventoryStore.createOptionCombinations
			});

			this.inventoryStore.resetDeletedOptions();
			this.inventoryStore.resetCreateVariants();

			await this.loadProduct(productResult.id).then(() => {
				this.router.navigate([`/pages/organization/inventory/edit/${this.inventoryItem.id}`]);

				this.toastrService.success('INVENTORY_PAGE.INVENTORY_ITEM_SAVED', {
					name: this.activeTranslation.name
				});
			});
		} catch (err) {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
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

	setTranslationSettings(): void {
		this.selectedLanguage =
			this.translateService.currentLang || this.store.preferredLanguage || LanguagesEnum.ENGLISH;

		this.translations = this.inventoryItem ? this.inventoryItem.translations : [];

		this.setActiveTranslation();
	}

	setActiveTranslation() {
		this.activeTranslation = this.translations.find((tr) => {
			return tr.languageCode === this.selectedLanguage;
		});

		if (!this.activeTranslation && this.organization) {
			const { id: organizationId, tenantId } = this.organization;
			this.activeTranslation = {
				languageCode: this.selectedLanguage,
				name: '',
				description: '',
				organizationId,
				tenantId
			};

			this.translations.push(this.activeTranslation);
		}
	}

	updateTranslations() {
		this.activeTranslation.name = this.form.get('name').value;
		this.activeTranslation.description = this.form.get('description').value;
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error.error.message || error.message);
	}

	onCancel() {
		this.location.back();
	}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	isActive(tab: NbTabComponent) {
		if (!this.inventoryStore.activeTab) {
			return tab.tabTitle == 'Main';
		} else {
			return this.inventoryStore.activeTab.tabTitle == tab.tabTitle;
		}
	}

	onChangeTab(tab: NbTabComponent) {
		this.inventoryStore.activeTab = tab;
	}
}
