import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProductType, Organization, ProductCategory } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { NbDialogRef } from '@nebular/theme';
import { ProductCategoryService } from '../../../@core/services/product-category.service';

@Component({
	selector: 'ngx-product-type-mutation',
	templateUrl: './product-category-mutation.component.html',
	styleUrls: ['./product-category-mutation.component.scss']
})
export class ProductCategoryMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	@Input() productCategory: ProductCategory;
	organizations: Organization[];
	selectedOrganization: Organization;

	constructor(
		public dialogRef: NbDialogRef<ProductCategory>,
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private productCategoryService: ProductCategoryService,
		private organizationService: OrganizationsService
	) {
		super(translationService);
	}

	ngOnInit() {
		this._loadOrganizations();
		this._initializeForm();

		if (this.productCategory) {
			this.selectedOrganization = this.productCategory.organization;
		}
	}

	async onSaveRequest() {
		const productCategoryRequest = {
			name: this.form.get('name').value,
			organization: this.selectedOrganization
		};

		let productCategory: ProductCategory;

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

	selectOrganiztion(organization: Organization) {
		if (!organization) return;
		this.selectedOrganization = organization;
	}

	async closeDialog(productType?: ProductType) {
		this.dialogRef.close(productType);
	}

	private async _loadOrganizations() {
		const { items } = await this.organizationService.getAll();
		this.organizations = items;
	}

	private _initializeForm() {
		this.form = this.fb.group({
			organizationId: [
				this.productCategory ? this.productCategory.organizationId : '',
				Validators.required
			],
			name: [
				this.productCategory ? this.productCategory.name : '',
				Validators.required
			]
		});
	}
}
