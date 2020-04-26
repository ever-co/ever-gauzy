import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Product extends IBaseEntityModel {
	name: string;
	description: string;
	enabled: boolean;
	code: string;
	variants?: ProductVariant[];
	options?: ProductOption[];
	productTypeId: string;
	productCategoryId: string;
	type?: ProductType;
	category?: ProductCategory;
}

export interface ProductType extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface ProductCategory extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface ProductVariant extends IBaseEntityModel {
	price: ProductVariantPrice;
	taxes: number;
	notes: string;
	enabled: boolean;
	productId: string;
	quantity: number;
	billingInvoicingPolicy: string;
	internalReference: string;
	options: ProductOption[];
	settings: ProductVariantSettings;
	product?: Product;
}

export interface ProductVariantPrice extends IBaseEntityModel {
	unitCost: number;
	unitCostCurrency: string;
	retailPrice: number;
	retailPriceCurrency: string;
}

export interface ProductVariantSettings extends IBaseEntityModel {
	isSubscription: boolean;
	isPurchaseAutomatically: boolean;
	canBeSold: boolean;
	canBePurchased: boolean;
	canBeCharged: boolean;
	canBeRented: boolean;
	isEquipment: boolean;
	trackInventory: boolean;
}

export interface ProductOption extends IBaseEntityModel {
	name: string;
	code: string;
}

export enum BillingInvoicingPolicyEnum {
	QUANTITY_ORDERED = 'Quantity ordered',
	QUANTITY_DELIVERED = 'Quantity Delivered'
}
