import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IPagination,
	IProductTypeTranslatable,
	IProductTypeTranslated
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-sdk/common';

@Injectable({ providedIn: 'root' })
export class ProductTypeService {
	PRODUCT_TYPES_URL = `${API_PREFIX}/product-types`;

	constructor(private http: HttpClient) {}

	getById(id: string = ''): Promise<IProductTypeTranslatable> {
		return firstValueFrom(this.http.get<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`));
	}

	getAll(options, params): Promise<{ items: IProductTypeTranslatable[] }> {
		const data = JSON.stringify(options);
		return firstValueFrom(
			this.http.get<{ items: IProductTypeTranslatable[] }>(this.PRODUCT_TYPES_URL, {
				params: { data, ...params }
			})
		);
	}

	getAllTranslated(where: IBasePerTenantAndOrganizationEntityModel): Observable<IPagination<IProductTypeTranslated>> {
		return this.http.get<IPagination<IProductTypeTranslated>>(`${this.PRODUCT_TYPES_URL}`, {
			params: toParams({ where })
		});
	}

	create(productTypeRequest: IProductTypeTranslatable): Promise<IProductTypeTranslatable> {
		return firstValueFrom(
			this.http.post<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}`, productTypeRequest)
		);
	}

	update(productTypeRequest: IProductTypeTranslatable): Promise<IProductTypeTranslatable> {
		return firstValueFrom(
			this.http.put<IProductTypeTranslatable>(
				`${this.PRODUCT_TYPES_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
		);
	}

	delete(id: string): Promise<IProductTypeTranslatable> {
		return firstValueFrom(this.http.delete<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`));
	}
}
