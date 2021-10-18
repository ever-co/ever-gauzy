import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IWarehouse,
	IWarehouseProductCreateInput,
	IWarehouseProduct,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class WarehouseService {
	WAREHOUSES_URL = `${API_PREFIX}/warehouses`;

	constructor(private http: HttpClient) { }

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return firstValueFrom(
			this.http
			.get<number>(
				`${this.WAREHOUSES_URL}/count`,
				{
					params: { data }
				}
			)
		);
	}

	getAll(options?, params?): Promise<{ items: IWarehouse[] }> {
		const data = JSON.stringify({
			relations: options.relations, findInput: options.findInput
		});
		return firstValueFrom(
			this.http
			.get<{ items: IWarehouse[] }>(`${this.WAREHOUSES_URL}`, {
				params: { data, ...params }
			})
		);
	}

	create(warehouseRequest: IWarehouse): Promise<IWarehouse> {
		return firstValueFrom(
			this.http
			.post<IWarehouse>(`${this.WAREHOUSES_URL}`, warehouseRequest)
		);
	}

	update(id: string, warehouseRequest: IWarehouse): Promise<IWarehouse> {
		return firstValueFrom(
			this.http
			.put<IWarehouse>(`${this.WAREHOUSES_URL}/${id}`, warehouseRequest)
		);
	}

	getById(id: string, relations?: string[], findInput?: any) {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<IWarehouse>(`${this.WAREHOUSES_URL}/${id}`, {
				params: { data }
			})
		);
	}

	deleteFeaturedImage(id: string): Promise<{ raw: any; affected: number }> {
		return firstValueFrom(
			this.http
			.delete<{ raw: any; affected: number }>(
				`${this.WAREHOUSES_URL}/${id}`
			)
		);
	}

	addWarehouseProducts(
		warehouseProductCreateInput: IWarehouseProductCreateInput[],
		warehouseId: String
	): Promise<IWarehouseProduct[]> {
		return firstValueFrom(
			this.http
			.post<IWarehouseProduct[]>(
				`${this.WAREHOUSES_URL}/inventory/${warehouseId}`,
				warehouseProductCreateInput
			)
		);
	}

	getWarehouseProducts(warehouseId: String) {
		return firstValueFrom(
			this.http
			.get<IWarehouseProduct[]>(
				`${this.WAREHOUSES_URL}/inventory/${warehouseId}`
			)
		);
	}

	updateWarehouseProductCount(
		warehouseProductId: String,
		count: number
	): Promise<IWarehouseProduct> {
		return firstValueFrom(
			this.http
			.post<IWarehouseProduct>(
				`${this.WAREHOUSES_URL}/inventory-quantity/${warehouseProductId}`,
				{ count: count }
			)
		);
	}

	updateWarehouseProductVariantCount(
		warehouseProductVariantId: String,
		count: number
	): Promise<IWarehouseProductVariant> {
		return firstValueFrom(
			this.http
			.post<IWarehouseProductVariant>(
				`${this.WAREHOUSES_URL}/inventory-quantity/variants/${warehouseProductVariantId}`,
				{ count: count }
			)
		);
	}
}
