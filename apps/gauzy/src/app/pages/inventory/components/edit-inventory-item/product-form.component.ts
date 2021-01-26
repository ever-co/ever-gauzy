import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import {
	FormGroup,
	FormBuilder,
	Validators,
	AbstractControl,
	ValidationErrors
} from '@angular/forms';
import {
	IProductOption,
	ITag,
	IProductTypeTranslated,
	IVariantOptionCombination,
	IProductCategoryTranslated,
	IProductVariant,
	LanguagesEnum,
	IOrganization,
	ILanguage,
	IProductTranslation,
	IProductTranslatable,
	IImageAsset
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from '../../../../@core/services/product-type.service';
import { ProductCategoryService } from '../../../../@core/services/product-category.service';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { Subject, BehaviorSubject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ProductService } from '../../../../@core/services/product.service';
import { Location } from '@angular/common';
import { Store } from '../../../../@core/services/store.service';
import { ProductVariantService } from '../../../../@core/services/product-variant.service';
import { ToastrService } from '../../../../@core/services/toastr.service';
import { VariantCreateInput } from './variant-form/variant-form.component';
import { NbTabComponent, NbTabsetComponent } from '@nebular/theme';

@Component({
	selector: 'ngx-product-form',
	templateUrl: './product-form.component.html',
	styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	form: FormGroup;
	inventoryItem: IProductTranslatable;
	featuredImage: IImageAsset;
	gallery: IImageAsset[];

	hoverState: boolean;
	selectedOrganizationId = '';
	productTypes: IProductTypeTranslated[];
	productCategories: IProductCategoryTranslated[];

	options: Array<IProductOption> = [];
	deletedOptions: Array<IProductOption> = [];

	optionsCombinations: Array<IVariantOptionCombination> = [];
	variants$: BehaviorSubject<IProductVariant[]> = new BehaviorSubject([]);
	variantsDb: VariantCreateInput[];

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

	private ngDestroy$ = new Subject<void>();

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
		private productVariantService: ProductVariantService
	) {
		super(translationService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe(async (params) => {
				this.productId = params.id || null;
			});
		this.store.selectedOrganization$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.selectedOrganizationId = organization.id;
					this.loadProductTypes();
					this.loadProductCategories();
					this.loadProduct(this.productId);
				}
			});
		this.store.systemLanguages$
			.pipe(takeUntil(this.ngDestroy$))
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

		this.setTranslationSettings();
	}

	ngOnDestroy(): void {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
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
		if (id) {
			const { id: organizationId, tenantId } = this.organization;
			this.inventoryItem = await this.productService.getById(
				id,
				[
					'category',
					'type',
					'options',
					'variants',
					'tags',
					'gallery',
					'featuredImage'
				],
				{ organizationId, tenantId }
			);
		}

		this.variants$.next(
			this.inventoryItem ? this.inventoryItem.variants : []
		);

		this.options = this.inventoryItem ? this.inventoryItem.options : [];
		this.tags = this.inventoryItem ? this.inventoryItem.tags : [];
		this.variantsDb = this.inventoryItem
			? this.inventoryItem.variants.map((variant: IProductVariant) => {
					return {
						options: variant.options.map(
							(option: IProductOption) => option.name
						),
						isStored: true,
						id: variant.id,
						productId: this.inventoryItem.id || null
					};
			  })
			: [];

		this.setTranslationSettings();
		this._initializeForm();

		this.form.valueChanges
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((formValue) => {
				this.updateTranslations();
			});
	}

	async loadProductTypes() {
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
		this.productTypes = items;
	}

	async loadProductCategories() {
		const { id: organizationId, tenantId } = this.organization;
		const searchCriteria = {
			organization: { id: organizationId },
			tenantId
		};
		const {
			items = []
		} = await this.productCategoryService.getAllTranslated(
			this.store.preferredLanguage || LanguagesEnum.ENGLISH,
			[],
			searchCriteria
		);
		this.productCategories = items;
	}

	async onSaveRequest() {
		const { id: organizationId, tenantId } = this.organization;
		const productRequest = {
			tags: this.form.get('tags').value,
			translations: this.translations,
			code: this.form.get('code').value,
			featuredImage: this.featuredImage || null,
			productTypeId: this.form.get('productTypeId').value,
			productCategoryId: this.form.get('productCategoryId').value,
			enabled: this.form.get('enabled').value,
			optionCreateInputs: this.options,
			optionDeleteInputs: this.deletedOptions,
			gallery: this.gallery || [],
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
				optionCombinations: this.optionsCombinations
			});

			await this.loadProduct(productResult.id);

			this.inventoryTabset.selectTab(this.variantsTab);

			this.router.navigate([
				`/pages/organization/inventory/edit/${this.inventoryItem.id}`
			]);

			this.toastrService.success('INVENTORY_PAGE.INVENTORY_ITEM_SAVED', {
				name: this.activeTranslation.name
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

		if (!this.activeTranslation) {
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

	onOptionsUpdated(options: IProductOption[]) {
		this.options = options;
	}

	onOptionDeleted(option: IProductOption) {
		this.deletedOptions.push(option);
	}

	onFeaturedImageUpdated(image: IImageAsset) {
		this.featuredImage = image;
	}

	onGalleryUpdated(gallery: IImageAsset[]) {
		this.gallery = gallery;
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

	onOptionCombinationsInputsUpdate(
		optionsCombinations: IVariantOptionCombination[]
	) {
		this.optionsCombinations = optionsCombinations;
	}
}
