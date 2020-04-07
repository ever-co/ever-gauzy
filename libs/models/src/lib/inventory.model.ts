import { Product as IProduct } from './product.model';
import { BaseEntityModel as IBaseEntityModel } from '..';

export interface Inventory extends IBaseEntityModel {
	stock: InventoryStock[];
	trackInventory: boolean;
}

export interface InventoryItem extends IBaseEntityModel, IProduct {}

export interface InventoryStock {
	item: InventoryItem;
	currentStock: number;
}
