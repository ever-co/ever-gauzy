import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Product, ProductType, ProductCategory } from '@gauzy/models';
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
	productItem: Product;

	productTypes: ProductType[];
	productCategories: ProductCategory[];

	@Output() save = new EventEmitter<Product>();
	@Output() cancel = new EventEmitter<void>();

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
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: ['', Validators.required],
			code: ['', Validators.required],
			productTypeId: ['', Validators.required],
			productCategoryId: ['', Validators.required],
			enabled: [true],
			description: ['']
		});
	}

	async loadProductTypes() {
		const res = await this.productTypeService.getAll({
			organizationId: this.store.selectedOrganization.id
		});
		this.productTypes = res.items;
	}

	async loadProductCategories() {
		const res = await this.productCategoryService.getAll({
			organizationId: this.store.selectedOrganization.id
		});
		this.productCategories = res.items;
	}

	onSaveRequest() {
		const newProduct = {
			name: this.form.get('name').value,
			code: this.form.get('code').value,
			productTypeId: this.form.get('productTypeId').value,
			productCategoryId: this.form.get('productCategoryId').value,
			enabled: this.form.get('enabled').value,
			description: this.form.get('description').value,
			variants: [],
			category: this.productCategories.find((c) => {
				return c.id === this.form.get('productCategoryId').value;
			}),
			type: this.productTypes.find((p) => {
				return p.id === this.form.get('productTypeId').value;
			})
		};

		this.save.emit(newProduct);
	}

	onCancel() {
		this.cancel.emit();
	}
}
