import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProductType, ProductTypesIconsEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { ProductTypeService } from '../../../@core/services/product-type.service';
import { NbDialogRef } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ngx-product-type-mutation',
	templateUrl: './product-type-mutation.component.html',
	styleUrls: ['./product-type-mutation.component.scss'],
})
export class ProductTypeMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	@Input() productType: ProductType;
	icons = Object.values(ProductTypesIconsEnum);

	selectedIcon: string = ProductTypesIconsEnum.STAR;
	languages: Array<string>;

	constructor(
		public dialogRef: NbDialogRef<ProductType>,
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private productTypeService: ProductTypeService,
		private store: Store
	) {
		super(translationService);
	}

	ngOnInit() {
		this._initializeForm();
		this.languages = this.translateService.getLangs();
	}

	async onSaveRequest() {
		const productTypeRequest = {
			name: this.form.get('name').value,
			organization: this.store.selectedOrganization,
			description: this.form.get('description').value,
			icon: this.selectedIcon,
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

	async closeDialog(productType?: ProductType) {
		this.dialogRef.close(productType);
	}

	private _initializeForm() {
		this.form = this.fb.group({
			organizationId: [
				this.productType ? this.productType.organizationId : '',
				Validators.required,
			],
			name: [
				this.productType ? this.productType.name : '',
				Validators.required,
			],
			description: [
				this.productType ? this.productType.description : null,
			],
		});
	}
}
