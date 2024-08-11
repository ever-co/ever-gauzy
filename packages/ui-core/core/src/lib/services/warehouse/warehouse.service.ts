import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IWarehouse,
	IWarehouseProductCreateInput,
	IWarehouseProduct,
	IWarehouseProductVariant,
	IPagination,
	IWarehouseFindInput
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class WarehouseService {
	WAREHOUSES_URL = `${API_PREFIX}/warehouses`;

	constructor(private readonly http: HttpClient) {}

	create(warehouse: IWarehouse): Promise<IWarehouse> {
		return firstValueFrom(this.http.post<IWarehouse>(`${this.WAREHOUSES_URL}`, warehouse));
	}

	getAll(where: IWarehouseFindInput): Promise<IPagination<IWarehouse>> {
		return firstValueFrom(
			this.http.get<IPagination<IWarehouse>>(`${this.WAREHOUSES_URL}`, {
				params: toParams({ where })
			})
		);
	}

	update(id: IWarehouse['id'], warehouse: IWarehouse): Promise<IWarehouse> {
		return firstValueFrom(this.http.put<IWarehouse>(`${this.WAREHOUSES_URL}/${id}`, warehouse));
	}

	getById(id: IWarehouse['id'], relations: string[] = []) {
		return firstValueFrom(
			this.http.get<IWarehouse>(`${this.WAREHOUSES_URL}/${id}`, {
				params: toParams({ relations })
			})
		);
	}

	deleteFeaturedImage(id: IWarehouse['id']): Promise<{ raw: any; affected: number }> {
		return firstValueFrom(this.http.delete<{ raw: any; affected: number }>(`${this.WAREHOUSES_URL}/${id}`));
	}

	addWarehouseProducts(
		warehouseProductCreateInput: IWarehouseProductCreateInput[],
		warehouseId: IWarehouse['id']
	): Promise<IWarehouseProduct[]> {
		return firstValueFrom(
			this.http.post<IWarehouseProduct[]>(
				`${this.WAREHOUSES_URL}/inventory/${warehouseId}`,
				warehouseProductCreateInput
			)
		);
	}

	getWarehouseProducts(warehouseId: IWarehouse['id']) {
		return firstValueFrom(this.http.get<IWarehouseProduct[]>(`${this.WAREHOUSES_URL}/inventory/${warehouseId}`));
	}

	updateWarehouseProductCount(
		warehouseProductId: IWarehouseProduct['id'],
		count: number
	): Promise<IWarehouseProduct> {
		return firstValueFrom(
			this.http.post<IWarehouseProduct>(`${this.WAREHOUSES_URL}/inventory-quantity/${warehouseProductId}`, {
				count: count
			})
		);
	}

	updateWarehouseProductVariantCount(
		warehouseProductVariantId: IWarehouseProductVariant['id'],
		count: number
	): Promise<IWarehouseProductVariant> {
		return firstValueFrom(
			this.http.post<IWarehouseProductVariant>(
				`${this.WAREHOUSES_URL}/inventory-quantity/variants/${warehouseProductVariantId}`,
				{ count: count }
			)
		);
	}
}
