import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProductType, Organization } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from '../../../@core/services/product-type.service';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ngx-product-type-mutation',
	templateUrl: './product-type-mutation.component.html',
	styleUrls: ['./product-type-mutation.component.scss']
})
export class ProductTypeMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	@Input() productType: ProductType;
	organizations: Organization[];
	selectedOrganization: Organization;

	constructor(
		public dialogRef: NbDialogRef<ProductType>,
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private productTypeService: ProductTypeService,
		private organizationService: OrganizationsService
	) {
		super(translationService);
	}

	ngOnInit() {
		this._loadOrganizations();
		this._initializeForm();

		if (this.productType) {
			this.selectedOrganization = this.productType.organization;
		}
	}

	async onSaveRequest() {
		const productTypeRequest = {
			name: this.form.get('name').value,
			organization: this.selectedOrganization
		};

		let productType: ProductType;

		if (!this.productType) {
			productType = await this.productTypeService.create(
				productTypeRequest
			);
		} else {
			productTypeRequest['id'] = this.productType.id;
			productType = await this.productTypeService.update(
				productTypeRequest
			);
		}

		this.closeDialog(productType);
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
				this.productType ? this.productType.organizationId : '',
				Validators.required
			],
			name: [
				this.productType ? this.productType.name : '',
				Validators.required
			]
		});
	}
}
