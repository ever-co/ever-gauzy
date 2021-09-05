import { Component, OnInit, ViewChild } from '@angular/core';
import {
	FormGroup,
	FormBuilder,
	Validators,
	AbstractControl,
	ValidationErrors
} from '@angular/forms';
import {
	ITag,
	IProductTypeTranslated,
	IProductCategoryTranslated,
	LanguagesEnum,
	IOrganization,
	ILanguage,
	IProductTranslation,
	IProductTranslatable
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from '../../../../@core/services/product-type.service';
import { ProductCategoryService } from '../../../../@core/services/product-category.service';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../../@core/services/product.service';
import { Location } from '@angular/common';
import { Store } from '../../../../@core/services/store.service';
import { ProductVariantService } from '../../../../@core/services/product-variant.service';
import { ToastrService } from '../../../../@core/services/toastr.service';
import { NbTabComponent, NbTabsetComponent } from '@nebular/theme';
import { InventoryStore } from '../../../../@core/services/inventory-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
	selector: 'ngx-product-form',
	templateUrl: './product-form.component.html',
	styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	inventoryItem: IProductTranslatable;

	hoverState: boolean;
	selectedOrganizationId = '';
	productTypes: IProductTypeTranslated[];
	productCategories: IProductCategoryTranslated[];

	languages: ILanguage[];
	selectedLanguage: string;
	translations = [];
	activeTranslation: IProductTranslation;

	tags: ITag[] = [];
	organization: IOrganization;
	productId: string;

	@ViewChild('inventoryTabset') inventoryTabset: NbTabsetComponent;

	@ViewChild('mainTab') mainTab: NbTabComponent;
	@ViewChild('optionsTab') optionsTab: NbTabComponent;
	@ViewChild('variantsTab') variantsTab: NbTabComponent;

	constructor(
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private readonly store: Store,
		private productService: ProductService,
		private productTypeService: ProductTypeService,
		private productCategoryService: ProductCategoryService,
		private route: ActivatedRoute,
		private location: Location,
		private router: Router,
		private toastrService: ToastrService,
		private productVariantService: ProductVariantService,
		private inventoryStore: InventoryStore
	) {
		super(translationService);
	}

	ngOnInit() {
		this.inventoryStore.clearCurrentProduct();
		this.setRouteSubscription();
		this.setOrganizationSubscription();
		this.setLanguageSubsctiption();
		this.setTranslationSettings();
	}

	private setRouteSubscription() {
		this.route.params
			.pipe(untilDestroyed(this))
			.subscribe(async (params) => {
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
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.selectedOrganizationId = organization.id;
					this.loadProductTypes(true);
					this.loadProductCategories(true);
					this.loadProduct(this.productId);
				}
			});
	}

	private setLanguageSubsctiption() {
		this.store.systemLanguages$
			.pipe(untilDestroyed(this))
			.subscribe((systemLanguages) => {
				if (systemLanguages && systemLanguages.length > 0) {
					this.languages = systemLanguages.map((item) => {
						return {
							value: item.code,
							name: item.name
						};
					});
				}
			});
	}

	private _initializeForm() {
		this.form = this.fb.group({
			tags: [this.inventoryItem ? this.inventoryItem.tags : ''],
			name: [
				this.activeTranslation ? this.activeTranslation.name : '',
				this.validateTranslationProperty('name')
			],
			code: [
				this.inventoryItem ? this.inventoryItem.code : '',
				Validators.required
			],
			productTypeId: [
				this.inventoryItem ? this.inventoryItem.productTypeId : '',
				Validators.required
			],
			productCategoryId: [
				this.inventoryItem ? this.inventoryItem.productCategoryId : '',
				Validators.required
			],
			enabled: [this.inventoryItem ? this.inventoryItem.enabled : true],
			description: [
				this.activeTranslation ? this.activeTranslation.description : ''
			],
			languageCode: [
				this.translateService.currentLang,
				Validators.required
			]
		});
	}

	validateTranslationProperty = (propertyName: string) => (
		control: AbstractControl
	): null | ValidationErrors => {
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
				[
					'productCategory',
					'productType',
					'optionGroups',
					'variants',
					'tags',
					'gallery',
					'featuredImage'
				],
				{ organizationId, tenantId }
			);

			this.inventoryStore.activeProduct = this.inventoryItem;
		}

		this.tags = this.inventoryItem ? this.inventoryItem.tags : [];

		this.setTranslationSettings();
		this._initializeForm();

		this.inventoryStore.initVariantCreateInputs();

		this.form.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
			this.updateTranslations();
		});
	}

	async loadProductTypes(newOrg = false) {
		if(!this.inventoryStore.productTypesLoaded && newOrg) {
			const { id: organizationId, tenantId } = this.organization;
			const searchCriteria = {
				organization: { id: organizationId },
				tenantId
			};
			const { items = [] } = await this.productTypeService.getAllTranslated(
				this.store.preferredLanguage || LanguagesEnum.ENGLISH,
				[],
				searchCriteria
			);

			this.inventoryStore.productTypes = items;
		}

		this.productTypes = this.inventoryStore.productTypes;
	}

	async loadProductCategories(newOrg = false) {
		if(!this.inventoryStore.productCategoriesLoaded && newOrg) {
			const { id: organizationId, tenantId } = this.organization;
			const searchCriteria = {
				organization: { id: organizationId },
				tenantId
			};
			const {
				items = []
			} = await this.productCategoryService.getAllTranslated(
				{langCode: this.store.preferredLanguage || LanguagesEnum.ENGLISH,
				findInput: searchCriteria,
				relations: []}
			);

			this.inventoryStore.productCategories = items;
		}

		this.productCategories = this.inventoryStore.productCategories;
	}

	async onSaveRequest() {
		const { id: organizationId, tenantId } = this.organization;

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
			category: this.productCategories.find((c) => {
				return c.id === this.form.get('productCategoryId').value;
			}),
			type: this.productTypes.find((p) => {
				return p.id === this.form.get('productTypeId').value;
			}),
			tenantId: tenantId,
			organizationId: organizationId
		};

		if (this.inventoryItem) {
			productRequest['id'] = this.inventoryItem.id;
		}

		try {
			let productResult: IProductTranslatable;

			if (!productRequest['id']) {
				productResult = await this.productService.create(
					productRequest
				);
			} else {
				productResult = await this.productService.update(
					productRequest
				);
			}

			await this.productVariantService.createProductVariants({
				product: productResult,
				optionCombinations: this.inventoryStore
					.createoOptionCombinations
			});

			this.inventoryStore.resetDeletedOptions();
			this.inventoryStore.resetCreateVariants();

			await this.loadProduct(productResult.id).then(() => {
				this.router.navigate([
					`/pages/organization/inventory/edit/${this.inventoryItem.id}`
				]);

				this.toastrService.success(
					'INVENTORY_PAGE.INVENTORY_ITEM_SAVED',
					{
						name: this.activeTranslation.name
					}
				);
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
			this.translateService.currentLang ||
			this.store.preferredLanguage ||
			LanguagesEnum.ENGLISH;

		this.translations = this.inventoryItem
			? this.inventoryItem.translations
			: [];

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
