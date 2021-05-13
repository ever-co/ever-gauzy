import {
	IBasePerTenantAndOrganizationEntityModel,
	IBasePerTenantEntityModel
} from './base-entity.model';
import { ITranslation, ITranslatable } from './translation.model';
import { ITag } from './tag-entity.model';
import { IContact } from 'index';

export interface IProduct extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	enabled: boolean;
	code: string;
	featuredImage?: IImageAsset;
	variants?: IProductVariant[];
	optionGroups?: IProductOptionGroupTranslatable[];
	productTypeId: string;
	productCategoryId: string;
	type?: IProductTypeTranslatable;
	category?: IProductCategoryTranslatable;
	tags?: ITag[];
	language?: string;
}

export interface IProductTranslatable
	extends ITranslatable<IProductTranslation> {
	enabled: boolean;
	code: string;
	featuredImage?: IImageAsset;
	variants?: IProductVariant[];
	optionGroups?: IProductOptionGroupTranslatable[];
	productTypeId: string;
	productCategoryId: string;
	type?: IProductTypeTranslatable;
	category?: IProductCategoryTranslatable;
	tags?: ITag[];
	gallery?: IImageAsset[];
}

export interface IProductTranslated
	extends IBasePerTenantAndOrganizationEntityModel {
	imageUrl: string;
	productType: string;
	productCategory: string;
	name: string;
	description: string;
	category?: string;
	type?: string;
	featuredImage?: IImageAsset;
	code: string;
	enabled: boolean;
	gallery?: IImageAsset[];
	options?: IProductOption[];
	tags?: ITag[];
	variants?: IProductVariant[];
	productTypeId: string;
	productCategoryId: string;
}

export interface IProductTranslation
	extends ITranslation<IProductTranslatable> {
	name: string;
	description: string;
}
export interface IProductCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	enabled: boolean;
	code: string;
	imageUrl: string;
	type?: IProductTypeTranslatable;
	category?: IProductCategoryTranslatable;
	tags?: ITag[];
	optionGroupUpdateInputs?: IProductOptionGroupTranslatable[];
	optionGroupCreateInputs?: IProductOptionGroupTranslatable[];
	optionGroupDeleteInputs?: IProductOptionGroupTranslatable[];
	optionDeleteInputs?: IProductOptionTranslatable[];
	translations: IProductTranslation[];
	language?: string;
}

export interface IProductTranslatableCreateInput
	extends ITranslatable<IProductTranslation> {
	enabled: boolean;
	code: string;
	featuredImage?: IImageAsset;
	gallery: IImageAsset[];
	type?: IProductTypeTranslatable;
	category?: IProductCategoryTranslatable;
	tags?: ITag[];
	optionCreateInputs?: IProductOptionTranslatable[];
	optionDeleteInputs?: IProductOptionTranslatable[];
}

export interface IProductFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export interface IProductTypeTranslatable
	extends ITranslatable<IProductTypeTranslation> {
	icon: string;
	name?: string;
	products?: IProductTranslatable[];
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
	name?: string;
	products?: IProductTranslatable[];
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
	image: IImageAsset;
	options: IProductOptionTranslatable[];
	settings: IProductVariantSetting;
	product?: IProductTranslatable;
}

export interface IVariantCreateInput {
	product: IProductTranslatable;
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
	product?: IProductTranslatable;
}

export interface IProductOptionTranslated
	extends IBasePerTenantAndOrganizationEntityModel {
	langCode: string;
	name: string;
	code: string;
	product?: IProductTranslatable;
}

export interface IProductOptionTranslatable
	extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	product?: IProductTranslatable;
	name?: string;
	description?: string;
	group?: IProductOptionGroupTranslatable;
	translations: IProductOptionTranslation[];
}

export interface IProductOptionTranslation
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	reference?: IProductOptionTranslatable;
	languageCode: string;
}

export interface IProductOptionGroupTranslatable
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	product?: IProductTranslatable;
	options: IProductOptionTranslatable[];
	translatedOptions?: IProductOptionTranslated[];
	translations: IProductOptionGroupTranslation[];
}

export interface IProductOptionGroupTranslation
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	reference?: IProductOptionGroupTranslatable;
	languageCode: string;
}

export interface IImageAsset extends IBasePerTenantEntityModel {
	name: string;
	url: string;
	width: number;
	height: number;
	isFeatured: boolean;
}

export interface IWarehouse extends IBasePerTenantEntityModel {
	description: string;
	active: boolean;
	contact: IContact;
	code: string;
	products?: IWarehouseProduct[];
	name: string;
	logo?: string;
	email: string;
	tags?: ITag[];
}

export interface IMerchant extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	code: string;
	contact: IContact;
	description: string;
	logo: IImageAsset;
	email: string;
	tags: ITag[];
	currency: string;
	warehouses: IWarehouse[];
	active: boolean;
}

export interface IMerchantCreateInput {
	name: string;
	code: string;
	contact: IContact;
	description: string;
	logo: IImageAsset;
	email: string;
	tags: ITag[];
	currency: string;
	warehouses: IWarehouse[];
	active: boolean;
}

export interface IWarehouseProduct extends IBasePerTenantEntityModel {
	warehouse: IWarehouse;
	quantity: number;
	product: IProductTranslatable;
	variants: IWarehouseProductVariant[];
}

export interface IWarehouseProductVariant extends IBasePerTenantEntityModel {
	quantity: number;
	variant: IProductVariant;
}

export interface IWarehouseProductCreateInput {
	productId: String;
	variantIds: String[];
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
