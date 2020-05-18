import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	Product,
	ProductType,
	ProductCategory,
	ProductOption,
	ProductVariant,
	ProductOptionUI
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from '../../../@core/services/product-type.service';
import { ProductCategoryService } from '../../../@core/services/product-category.service';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ngx-product-form',
	templateUrl: './product-form.component.html',
	styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	@Input() product: Product;

	activeOption: ProductOptionUI = {};
	optionMode = 'create';

	productTypes: ProductType[];
	productCategories: ProductCategory[];
	options: Array<ProductOption> = [];
	variants: Array<ProductVariant> = [];

	@Output() save = new EventEmitter<Product>();
	@Output() cancel = new EventEmitter<string>();
	@Output() editProductVariant = new EventEmitter<string>();

	constructor(
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private readonly store: Store,
		private productTypeService: ProductTypeService,
		private productCategoryService: ProductCategoryService
	) {
		super(translationService);
	}

	ngOnInit() {
		this.loadProductTypes();
		this.loadProductCategories();
		this._initializeForm();

		this.options = this.product ? this.product.options : [];
		this.variants = this.product ? this.product.variants : [];
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: [this.product ? this.product.name : '', Validators.required],
			code: [this.product ? this.product.code : '', Validators.required],
			productTypeId: [
				this.product ? this.product.productTypeId : '',
				Validators.required
			],
			productCategoryId: [
				this.product ? this.product.productCategoryId : '',
				Validators.required
			],
			enabled: [this.product ? this.product.enabled : true],
			description: [this.product ? this.product.description : '']
		});
	}

	async loadProductTypes() {
		const res = await this.productTypeService.getAll([], {
			organizationId: this.store.selectedOrganization.id
		});
		this.productTypes = res.items;
	}

	async loadProductCategories() {
		const res = await this.productCategoryService.getAll([], {
			organizationId: this.store.selectedOrganization.id
		});
		this.productCategories = res.items;
	}

	onSaveRequest() {
		const productRequest = {
			name: this.form.get('name').value,
			code: this.form.get('code').value,
			productTypeId: this.form.get('productTypeId').value,
			productCategoryId: this.form.get('productCategoryId').value,
			enabled: this.form.get('enabled').value,
			description: this.form.get('description').value,
			variants: this.variants,
			options: this.options,
			category: this.productCategories.find((c) => {
				return c.id === this.form.get('productCategoryId').value;
			}),
			type: this.productTypes.find((p) => {
				return p.id === this.form.get('productTypeId').value;
			})
		};

		if (this.product) {
			productRequest['id'] = this.product.id;
		}

		this.save.emit(productRequest);
	}

	onSaveOption() {
		if (!(this.activeOption.name && this.activeOption.code)) return;

		switch (this.optionMode) {
			case 'create':
				this.options.push({
					name: this.activeOption.name,
					code: this.activeOption.code
				});
				break;
			case 'edit': {
				const target = this.options.find(
					(option) => option.name === this.activeOption.oldName
				);
				target.name = this.activeOption.name;
				target.code = this.activeOption.code;
				break;
			}
		}

		this.optionMode = 'create';
		this.activeOption = {};
	}

	onRemoveOption($event: any) {
		const optionElement = $event.path.find((el: any) =>
			el.classList.contains('option')
		);
		const removeOptionTitle = optionElement ? optionElement.innerText : '';

		if (!removeOptionTitle) return;

		this.options = this.options.filter(
			(option) => option.name !== removeOptionTitle
		);
	}

	onEditOption($event: any) {
		this.optionMode = 'edit';
		const target = this.options.find(
			(option) => option.name === $event.target.innerText
		);

		if (!target) return;

		this.activeOption = {
			name: target.name,
			code: target.code,
			oldName: target.name
		};
	}

	onEditProductVariant(productVariantId: string) {
		this.editProductVariant.emit(productVariantId);
	}

	onCancel() {
		this.cancel.emit('PRODUCT_EDIT');
	}
}
