import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Product {
	name: string;
	enabled: boolean;
	productTypeId: string;
	productCategoryId: string;
	isSubscription: boolean;
	isPurchaseAutomatically: boolean;
	canBeSold: boolean;
	canBePurchased: boolean;
	canBeCharged: boolean;
	canBeRented: boolean;
	isEquipment: boolean;
	internalReference: string;
	code: string;
	notes: string;
	description: string;
	unitCost: number;
	unitCostCurrency: string;
	retailPrice: number;
	retailPriceCurrency: string;
	quantity: number;
	taxes: number;
	billingInvoicingPolicy: string;
	productType?: ProductType;
	productCategory?: ProductCategory;
}

export interface ProductType extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface ProductCategory extends IBaseEntityModel {
	name: string;
	organizationId: string;
}
