import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IPagination,
	IProductCategoryTranslatable,
	IProductCategoryTranslated
} from '@gauzy/contracts';
import { firstValueFrom, Observable } from 'rxjs';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductCategoryService {
	PRODUCT_CATEGORY_URL = `${API_PREFIX}/product-categories`;

	constructor(private http: HttpClient) {}

	getById(id: string): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(this.http.get<IProductCategoryTranslatable>(`${this.PRODUCT_CATEGORY_URL}/${id}`));
	}

	getAllTranslated(
		where: IBasePerTenantAndOrganizationEntityModel
	): Observable<IPagination<IProductCategoryTranslated>> {
		return this.http.get<IPagination<IProductCategoryTranslated>>(`${this.PRODUCT_CATEGORY_URL}`, {
			params: toParams({ where })
		});
	}

	create(productTypeRequest: IProductCategoryTranslatable): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(
			this.http.post<IProductCategoryTranslatable>(`${this.PRODUCT_CATEGORY_URL}`, productTypeRequest)
		);
	}

	update(productTypeRequest: IProductCategoryTranslatable): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(
			this.http.put<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
		);
	}

	delete(id: string): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(this.http.delete<IProductCategoryTranslatable>(`${this.PRODUCT_CATEGORY_URL}/${id}`));
	}
}
