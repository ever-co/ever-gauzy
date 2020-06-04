import {
	Component,
	OnInit,
	Output,
	EventEmitter,
	OnDestroy
} from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	Product,
	ProductCategory,
	ProductOption,
	Tag,
	ProductTypeTranslated,
	IVariantOptionCombination
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from 'apps/gauzy/src/app/@core/services/product-type.service';
import { ProductCategoryService } from 'apps/gauzy/src/app/@core/services/product-category.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject, BehaviorSubject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
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
	productCategories: ProductCategory[];

	options: Array<ProductOption> = [];
	deletedOptions: Array<ProductOption> = [];
	//tstodo
	variantCreateInputs: Array<IVariantOptionCombination> = [];
	variants$: BehaviorSubject<any[]> = new BehaviorSubject([]);

	languages: Array<string>;

	// variantSuggestions: Array<any> = [];
	tags: Tag[] = [];

	private ngDestroy$ = new Subject<void>();

	@Output() save = new EventEmitter<Product>();
	@Output() cancel = new EventEmitter<string>();

	constructor(
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private readonly store: Store,
		private productService: ProductService,
		private productTypeService: ProductTypeService,
		private productCategoryService: ProductCategoryService,
		private route: ActivatedRoute,
		private location: Location,
		private toastrService: NbToastrService,
		private productVariantService: ProductVariantService
	) {
		super(translationService);
	}

	ngOnInit() {
		this.loadProductTypes();
		this.loadProductCategories();

		this.route.params
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe(async (params) => {
				this.inventoryItem = params.id
					? await this.productService.getById(params.id)
					: null;

				this.variants$.next(
					this.inventoryItem ? this.inventoryItem.variants : []
				);

				this.options = this.inventoryItem
					? this.inventoryItem.options
					: [];
				this.tags = this.inventoryItem ? this.inventoryItem.tags : [];

				this._initializeForm();

				console.log(this.inventoryItem, 'on init');
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					//tstodo
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
		const res = await this.productTypeService.getAllTranslated(
			this.store.preferredLanguage,
			['organization']
		);
		this.productTypes = res.items;
	}

	async loadProductCategories() {
		const res = await this.productCategoryService.getAll(
			this.store.preferredLanguage,
			[],
			{
				organizationId: this.selectedOrganizationId
			}
		);
		this.productCategories = res.items;
	}

	async onSaveRequest() {
		const productRequest = {
			tags: this.form.get('tags').value,
			name: this.form.get('name').value,
			code: this.form.get('code').value,
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

				this.inventoryItem.variants = await this.productVariantService.createProductVariants(
					{
						product: this.inventoryItem,
						optionCombinations: this.variantCreateInputs
					}
				);

				this.variants$.next(this.inventoryItem.variants);
			} else {
				this.inventoryItem = await this.productService.update(
					productRequest
				);
			}

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

	// tstodo
	handleImageUploadError(event: any) {}

	onCancel() {
		this.location.back();
	}

	selectedTagsEvent(currentSelection: Tag[]) {
		this.form.get('tags').setValue(currentSelection);
	}
	//tstodo
	onVariantCreateInputsUpdate(
		variantCreateInputs: IVariantOptionCombination[]
	) {
		this.variantCreateInputs = variantCreateInputs;
	}
}
