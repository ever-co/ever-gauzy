import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IExpenseCategory, IExpenseCategoryFind, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ExpenseCategoriesService {
	private http = inject(HttpClient);

	getAll(where: IExpenseCategoryFind): Observable<IPagination<IExpenseCategory>> {
		return this.http.get<IPagination<IExpenseCategory>>(`${API_PREFIX}/expense-categories`, {
			params: toParams({ where })
		});
	}

	create(category: IExpenseCategory): Observable<IExpenseCategory> {
		return this.http.post<IExpenseCategory>(`${API_PREFIX}/expense-categories`, category);
	}
}
