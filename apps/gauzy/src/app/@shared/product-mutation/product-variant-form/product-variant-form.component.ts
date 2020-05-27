import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import {
	ProductVariant,
	CurrenciesEnum,
	BillingInvoicingPolicyEnum,
} from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

@Component({
	selector: 'ngx-product-variant-form',
	templateUrl: './product-variant-form.component.html',
	styleUrls: ['./product-variant-form.component.scss'],
})
export class ProductVariantFormComponent extends TranslationBaseComponent
	implements OnInit {
	@Output() save = new EventEmitter<any>();
	@Output() delete = new EventEmitter<any>();
	@Output() cancel = new EventEmitter<string>();

	currencies = Object.values(CurrenciesEnum);
	billingInvoicingPolicies = Object.values(BillingInvoicingPolicyEnum);

	form: FormGroup;
	@Input() productVariant: ProductVariant;

	constructor(translationService: TranslateService, private fb: FormBuilder) {
		super(translationService);
	}
	ngOnInit(): void {
		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			internationalReference: [
				this.productVariant.internalReference || '',
				Validators.required,
			],
			invoicingPolicy: [
				this.productVariant.billingInvoicingPolicy || '',
				Validators.required,
			],
			quantity: [
				this.productVariant.quantity || 0,
				[Validators.required, Validators.min(0)],
			],
			taxes: [
				this.productVariant.taxes || 0,
				[Validators.required, Validators.min(0)],
			],
			retailPrice: [
				this.productVariant.price.retailPrice || 0,
				[Validators.required, Validators.min(0)],
			],
			retailPriceCurrency: [
				this.productVariant.price.retailPriceCurrency ||
					CurrenciesEnum.USD,
				Validators.required,
			],
			unitCost: [
				this.productVariant.price.unitCost || 0,
				[Validators.required, Validators.min(0)],
			],
			unitCostCurrency: [
				this.productVariant.price.unitCostCurrency ||
					CurrenciesEnum.USD,
				Validators.required,
			],
			enabled: [this.productVariant.enabled || true, Validators.required],
			isSubscription: [
				this.productVariant.settings.isSubscription || false,
			],
			isPurchaseAutomatically: [
				this.productVariant.settings.isPurchaseAutomatically || false,
			],
			canBeSold: [this.productVariant.settings.canBeSold || true],
			canBePurchased: [
				this.productVariant.settings.canBePurchased || true,
			],
			canBeCharged: [this.productVariant.settings.canBeCharged || true],
			canBeRented: [this.productVariant.settings.canBeRented || false],
			trackInventory: [
				this.productVariant.settings.trackInventory || false,
			],
			isEquipment: [this.productVariant.settings.isEquipment || false],
			notes: [this.productVariant.notes || ''],
		});
	}

	onCancel() {
		this.cancel.emit('PRODUCT_VARIANT_EDIT');
	}

	onSaveRequest() {
		const formValue = this.form.value;

		const productVariantRequest = {
			productVariant: {
				id: this.productVariant.id,
				internalReference: formValue['internationalReference'],
				billingInvoicingPolicy: formValue['invoicingPolicy'],
				quantity: formValue['quantity'],
				taxes: formValue['taxes'],
				enabled: formValue['enabled'],
				notes: formValue['notes'],
			},
			productVariantPrice: {
				id: this.productVariant.price.id,
				retailPrice: formValue['retailPrice'],
				retailPriceCurrency: formValue['retailPriceCurrency'],
				unitCost: formValue['unitCost'],
				unitCostCurrency: formValue['unitCostCurrency'],
			},
			productVariantSettings: {
				id: this.productVariant.settings.id,
				isSubscription: formValue['isSubscription'],
				isPurchaseAutomatically: formValue['isPurchaseAutomatically'],
				canBeSold: formValue['canBeSold'],
				canBePurchased: formValue['canBePurchased'],
				canBeCharged: formValue['canBeCharged'],
				canBeRented: formValue['canBeRented'],
				trackInventory: formValue['trackInventory'],
				isEquipment: formValue['isEquipment'],
			},
		};

		this.save.emit(productVariantRequest);
	}

	onDelete() {
		this.delete.emit(this.productVariant);
	}
}
