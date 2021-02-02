import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IExpenseCategory } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class ExpenseCategoriesService {
	constructor(private http: HttpClient) {}

	getAll(): Observable<{ items: IExpenseCategory[]; total: number }> {
		return this.http.get<{ items: IExpenseCategory[]; total: number }>(
			`${API_PREFIX}/expense-categories`
		);
	}

	create(createDto): Observable<IExpenseCategory> {
		return this.http.post<IExpenseCategory>(
			`${API_PREFIX}/expense-categories`,
			createDto
		);
	}
}
