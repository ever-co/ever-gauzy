import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProductCategory } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { ProductCategoryService } from '../../../@core/services/product-category.service';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ToastrService } from '../../../@core/services/toastr.service';

@Component({
	selector: 'ngx-product-type-mutation',
	templateUrl: './product-category-mutation.component.html',
	styleUrls: ['./product-category-mutation.component.scss'],
})
export class ProductCategoryMutationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private ngDestroy$ = new Subject<void>();

	form: FormGroup;
	@Input() productCategory: ProductCategory;

	languages: Array<string>;
	hoverState: boolean;

	constructor(
		public dialogRef: NbDialogRef<ProductCategory>,
		readonly translationService: TranslateService,
		private fb: FormBuilder,
		private productCategoryService: ProductCategoryService,
		private store: Store,
		private toastrService: ToastrService
	) {
		super(translationService);
	}

	ngOnInit() {
		this._initializeForm();
		this.languages = this.translateService.getLangs();
	}

	async onSaveRequest() {
		const productCategoryRequest = {
			name: this.form.get('name').value,
			organization: this.store.selectedOrganization,
			description: this.form.get('description').value,
			imageUrl: this.form.get('imageUrl').value,
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

	async closeDialog(productCategory?: ProductCategory) {
		this.dialogRef.close(productCategory);
	}

	private _initializeForm() {
		this.form = this.fb.group({
			organizationId: [
				this.productCategory ? this.productCategory.organizationId : '',
				Validators.required,
			],
			name: [
				this.productCategory ? this.productCategory.name : '',
				Validators.required,
			],
			imageUrl: [
				this.productCategory ? this.productCategory.imageUrl : null,
			],
			description: [
				this.productCategory ? this.productCategory.description : null,
			],
		});
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(
			error.error.message || error.message,
			'Error'
		);
	}

	ngOnDestroy(): void {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}
