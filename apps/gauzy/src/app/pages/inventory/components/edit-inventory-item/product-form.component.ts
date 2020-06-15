import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	Product,
	ProductOption,
	Tag,
	ProductTypeTranslated,
	IVariantOptionCombination,
	ProductCategoryTranslated,
	ProductVariant,
	LanguagesEnum
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from 'apps/gauzy/src/app/@core/services/product-type.service';
import { ProductCategoryService } from 'apps/gauzy/src/app/@core/services/product-category.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject, BehaviorSubject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ProductService } from 'apps/gauzy/src/app/@core/services/product.service';
import { Location } from '@angular/common';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { NbToastrService } from '@nebular/theme';
import { ProductVariantService } from 'apps/gauzy/src/app/@core/services/product-variant.service';

@Component({
	selector: 'ngx-product-form',
	templateUrl: './product-form.component.html',
	styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	form: FormGroup;
	inventoryItem: Product;

	hoverState: boolean;
	selectedOrganizationId = '';
	productTypes: ProductTypeTranslated[];
	productCategories: ProductCategoryTranslated[];

	options: Array<ProductOption> = [];
	deletedOptions: Array<ProductOption> = [];

	optionsCombinations: Array<IVariantOptionCombination> = [];
	variants$: BehaviorSubject<ProductVariant[]> = new BehaviorSubject([]);

	languages: Array<string>;
	tags: Tag[] = [];

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
		private toastrService: NbToastrService,
		private productVariantService: ProductVariantService
	) {
		super(translationService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe(async (params) => {
				this.inventoryItem = params.id
					? await this.productService.getById(params.id, [
							'category',
							'type',
							'options',
							'variants',
							'tags'
					  ])
					: null;

				this.variants$.next(
					this.inventoryItem ? this.inventoryItem.variants : []
				);

				this.options = this.inventoryItem
					? this.inventoryItem.options
					: [];
				this.tags = this.inventoryItem ? this.inventoryItem.tags : [];

				this._initializeForm();
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					this.loadProductTypes();
					this.loadProductCategories();
				}
			});

		this.languages = this.translateService.getLangs();
	}

	ngOnDestroy(): void {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			tags: [this.inventoryItem ? this.inventoryItem.tags : ''],
			name: [
				this.inventoryItem ? this.inventoryItem.name : '',
				Validators.required
			],
			code: [
				this.inventoryItem ? this.inventoryItem.code : '',
				Validators.required
			],
			imageUrl: [this.inventoryItem ? this.inventoryItem.imageUrl : null],
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
				this.inventoryItem ? this.inventoryItem.description : ''
			]
		});
	}

	async loadProductTypes() {
		const searchCriteria = this.selectedOrganizationId
			? { organization: { id: this.selectedOrganizationId } }
			: null;

		const res = await this.productTypeService.getAllTranslated(
			this.store.preferredLanguage || LanguagesEnum.ENGLISH,
			[],
			searchCriteria
		);
		this.productTypes = res.items;
	}

	async loadProductCategories() {
		const searchCriteria = this.selectedOrganizationId
			? { organization: { id: this.selectedOrganizationId } }
			: null;

		const res = await this.productCategoryService.getAllTranslated(
			this.store.preferredLanguage || LanguagesEnum.ENGLISH,
			[],
			searchCriteria
		);
		this.productCategories = res.items;
	}

	async onSaveRequest() {
		const productRequest = {
			tags: this.form.get('tags').value,
			name: this.form.get('name').value,
			code: this.form.get('code').value,
			imageUrl: this.form.get('imageUrl').value,
			productTypeId: this.form.get('productTypeId').value,
			productCategoryId: this.form.get('productCategoryId').value,
			enabled: this.form.get('enabled').value,
			description: this.form.get('description').value,
			optionCreateInputs: this.options,
			optionDeleteInputs: this.deletedOptions,
			category: this.productCategories.find((c) => {
				return c.id === this.form.get('productCategoryId').value;
			}),
			type: this.productTypes.find((p) => {
				return p.id === this.form.get('productTypeId').value;
			})
		};

		if (this.inventoryItem) {
			productRequest['id'] = this.inventoryItem.id;
		}

		try {
			if (!productRequest['id']) {
				this.inventoryItem = await this.productService.create(
					productRequest
				);
			} else {
				this.inventoryItem = await this.productService.update(
					productRequest
				);
			}

			if (!this.inventoryItem.variants) {
				this.inventoryItem.variants = [];
			}

			this.inventoryItem.variants.push(
				...(await this.productVariantService.createProductVariants({
					product: this.inventoryItem,
					optionCombinations: this.optionsCombinations
				}))
			);

			//tstodo
			console.log(this.inventoryItem.variants);

			this.variants$.next(this.inventoryItem.variants);

			this.router.navigate([
				`/pages/organization/inventory/edit/${this.inventoryItem.id}`
			]);

			this.toastrService.success(
				this.getTranslation('TOASTR.TITLE.SUCCESS'),
				this.getTranslation('INVENTORY_PAGE.INVENTORY_ITEM_SAVED')
			);
		} catch (err) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.TITLE.ERROR'),
				this.getTranslation('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED')
			);
		}
	}

	onOptionsUpdated(options: ProductOption[]) {
		this.options = options;
	}

	onOptionDeleted(option: ProductOption) {
		this.deletedOptions.push(option);
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(
			error.error.message || error.message,
			'Error'
		);
	}

	onCancel() {
		this.location.back();
	}

	selectedTagsEvent(currentSelection: Tag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	onOptionCombinationsInputsUpdate(
		optionsCombinations: IVariantOptionCombination[]
	) {
		this.optionsCombinations = optionsCombinations;
	}
}
