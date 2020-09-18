import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITranslation, ITranslatable } from './translation.model';
import { ITenant } from './tenant.model';
import { ITag } from './tag-entity.model';

export interface IProduct extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	enabled: boolean;
	code: string;
	imageUrl: string;
	variants?: IProductVariant[];
	options?: IProductOption[];
	productTypeId: string;
	productCategoryId: string;
	type?: IProductTypeTranslatable;
	category?: IProductCategoryTranslatable;
	tags?: ITag[];
	language?: string;
}

export interface IProductCreateInput {
	name: string;
	description: string;
	enabled: boolean;
	code: string;
	imageUrl: string;
	type?: IProductTypeTranslatable;
	category?: IProductCategoryTranslatable;
	tags?: ITag[];
	optionCreateInputs?: IProductOption[];
	optionDeleteInputs?: IProductOption[];
	tenant: ITenant;
	language?: string;
}

export interface IProductFindInput {
	organizationId?: string;
	id?: string;
}

export interface IProductTypeTranslatable
	extends ITranslatable<IProductTypeTranslation> {
	icon: string;
	products?: IProduct[];
}

export interface IProductTypeTranslation
	extends ITranslation<IProductTypeTranslatable> {
	name: string;
	description: string;
}

export interface IProductTypeTranslated
	extends IBasePerTenantAndOrganizationEntityModel {
	icon: string;
	name: string;
	description: string;
}

export interface IProductCategoryTranslatable
	extends ITranslatable<IProductCategoryTranslation> {
	imageUrl: string;
	products?: IProduct[];
}

export interface IProductCategoryTranslation
	extends ITranslation<IProductCategoryTranslatable> {
	name: string;
	description: string;
}

export interface IProductCategoryTranslated
	extends IBasePerTenantAndOrganizationEntityModel {
	imageUrl: string;
	name: string;
	description: string;
}

export interface IProductVariant
	extends IBasePerTenantAndOrganizationEntityModel {
	price: IProductVariantPrice;
	taxes: number;
	notes: string;
	enabled: boolean;
	productId: string;
	quantity: number;
	billingInvoicingPolicy: string;
	internalReference: string;
	options: IProductOption[];
	settings: IProductVariantSetting;
	product?: IProduct;
}

export interface IVariantCreateInput {
	product: IProduct;
	optionCombinations: IVariantOptionCombination[];
}

export interface IVariantOptionCombination {
	options: string[];
}

export interface IProductVariantPrice
	extends IBasePerTenantAndOrganizationEntityModel {
	unitCost: number;
	unitCostCurrency: string;
	retailPrice: number;
	retailPriceCurrency: string;
	productVariant: IProductVariant;
}

export interface IProductVariantSetting
	extends IBasePerTenantAndOrganizationEntityModel {
	isSubscription: boolean;
	isPurchaseAutomatically: boolean;
	canBeSold: boolean;
	canBePurchased: boolean;
	canBeCharged: boolean;
	canBeRented: boolean;
	isEquipment: boolean;
	trackInventory: boolean;
	productVariant: IProductVariant;
}

export interface IProductOption
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	code: string;
	product?: IProduct;
}

export enum BillingInvoicingPolicyEnum {
	QUANTITY_ORDERED = 'Quantity ordered',
	QUANTITY_DELIVERED = 'Quantity Delivered'
}

export enum ProductTypesIconsEnum {
	BRIEFCASE = 'briefcase-outline',
	CAR = 'car-outline',
	COLOR_PALETTE = 'color-palette-outline',
	FLASH = 'flash-outline',
	HOME = 'home-outline',
	GIFT = 'gift-outline',
	HEART = 'heart-outline',
	RADIO_BTN_OFF = 'radio-button-off-outline',
	PIN = 'pin-outline',
	SETTINGS = 'settings-outline',
	STAR = 'star-outline',
	SHOPPING_BAG = 'shopping-bag-outline',
	SHARE = 'share-outline',
	ACTIVITY = 'activity-outline',
	ALERT = 'alert-triangle-outline',
	BULB = 'bulb-outline',
	CHECKMARK = 'checkmark-circle-outline',
	GLOBE = 'globe-2-outline',
	LAYERS = 'layers-outline',
	PHONE = 'phone-outline',
	SHOPPING_CART = 'shopping-cart-outline'
}
