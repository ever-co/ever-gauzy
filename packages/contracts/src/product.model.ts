import {
	IBasePerTenantAndOrganizationEntityModel,
	IBasePerTenantEntityModel
} from './base-entity.model';
import { ITranslation, ITranslatable } from './translation.model';
import { ITag } from './tag-entity.model';
import { IContact } from './contact.model';
import { IInvoiceItem } from './invoice-item.model';

export interface IProduct extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	enabled: boolean;
	code: string;
	imageUrl: string;
	featuredImage?: IImageAsset;
	variants?: IProductVariant[];
	optionGroups?: IProductOptionGroupTranslatable[];
	productTypeId: string;
	productCategoryId: string;
	productType?: IProductTypeTranslatable;
	productCategory?: IProductCategoryTranslatable;
	tags?: ITag[];
	language?: string;
}

export interface IProductTranslatable
	extends ITranslatable<IProductTranslation> {
	enabled: boolean;
	code: string;
	imageUrl: string;
	featuredImage?: IImageAsset;
	featuredImageId?: string;
	productType?: IProductTypeTranslatable;
	productTypeId?: string;
	productCategory?: IProductCategoryTranslatable;
	productCategoryId?: string;
	variants?: IProductVariant[];
	optionGroups?: IProductOptionGroupTranslatable[];
	invoiceItems?: IInvoiceItem[];
	warehouses?: IWarehouse[];
	tags?: ITag[];
	gallery?: IImageAsset[];
}

export interface IProductTranslated
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	code: string;
	enabled: boolean;
	imageUrl: string;
	productType?: IProductTypeTranslatable;
	productCategory?: IProductCategoryTranslatable;
	description: string;
	featuredImage?: IImageAsset;
	gallery?: IImageAsset[];
	options?: IProductOption[];
	tags?: ITag[];
	variants?: IProductVariant[];
	productTypeId?: string;
	productCategoryId?: string;
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
	taxes: number;
	notes: string;
	quantity: number;
	billingInvoicingPolicy: string;
	internalReference: string;
	enabled: boolean;
	price: IProductVariantPrice;
	setting: IProductVariantSetting;
	product?: IProductTranslatable;
	productId?: string;
	image?: IImageAsset;
	imageId?: string;
	options: IProductOptionTranslatable[];
	warehouseProductVariants?: IWarehouseProductVariant[];
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
	name: string;
	code: string;
	product?: IProductTranslatable;
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
	name: string;
	product?: IProductTranslatable;
	productId?: string;
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
	name: string;
	email: string;
	description: string;
	code: string;
	active: boolean;
	logo?: IImageAsset;
	logoId?: string;
	contact?: IContact;
	contactId?: string;
	products?: IWarehouseProduct[];
	tags?: ITag[];
}

export interface IMerchant extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	email: string;
	phone: string;
	code: string;
	active: boolean;
	currency: string;
	description: string;
	contact?: IContact;
	contactId?: string;
	logo?: IImageAsset;
	logoId?: string;
	tags?: ITag[];
	warehouses?: IWarehouse[];
}

export interface IMerchantCreateInput {
	name: string;
	code: string;
	contact: IContact;
	description: string;
	logo: IImageAsset;
	email: string;
	phone: string;
	tags: ITag[];
	currency: string;
	warehouses: IWarehouse[];
	active: boolean;
}

export interface IWarehouseProduct extends IBasePerTenantEntityModel {
	quantity: number;
	warehouse: IWarehouse;
	warehouseId?: string;
	product: IProductTranslatable;
	productId?: string;
	variants: IWarehouseProductVariant[];
}

export interface IWarehouseProductVariant extends IBasePerTenantEntityModel {
	quantity: number;
	variant: IProductVariant;
}

export interface IWarehouseProductCreateInput extends IBasePerTenantEntityModel {
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
