import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IExpenseCategory } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class ExpenseCategoriesService {
	constructor(private http: HttpClient) {}

	getAll(): Observable<{ items: IExpenseCategory[]; total: number }> {
		return this.http.get<{ items: IExpenseCategory[]; total: number }>(
			'/api/expense-categories'
		);
	}

	create(createDto): Observable<IExpenseCategory> {
		return this.http.post<IExpenseCategory>(
			'/api/expense-categories',
			createDto
		);
	}
}
