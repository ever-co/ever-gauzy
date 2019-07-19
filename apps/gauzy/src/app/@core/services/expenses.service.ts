import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
    Expense,
    ExpenseCreateInput as IExpenseCreateInput,
    ExpenseFindInput as IExpenseFindInput,
    ExpenseUpdateInput as IExpenseUpdateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class ExpensesService {

    constructor(private http: HttpClient) { }

    create(createInput: IExpenseCreateInput): Promise<any> {
        return this.http.post<Expense>('/api/expense/create', createInput).pipe(first()).toPromise();
    }

    getAll(relations?: string[], findInput?: IExpenseFindInput, filterDate?: Date): Promise<{ items: Expense[], total: number }> {
        const data = JSON.stringify({ relations, findInput, filterDate });

        return this.http.get<{ items: Expense[], total: number }>(`/api/expense`, {
            params: { data }
        }).pipe(first()).toPromise();
    }

    update(id: string, updateInput: IExpenseUpdateInput): Promise<any> {
        return this.http.put(`/api/expense/${id}`, updateInput).pipe(first()).toPromise();
    }

    delete(id: string): Promise<any> {
        return this.http.delete(`/api/expense/${id}`).pipe(first()).toPromise();
    }
}
