import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { OrganizationRecurringExpense, OrganizationRecurringExpenseFindInput } from '@gauzy/models';

@Injectable({
    providedIn: 'root'
})
export class OrganizationRecurringExpenseService {

    constructor(private http: HttpClient) { }

    create(createInput: OrganizationRecurringExpense): Promise<any> {
        return this.http.post<OrganizationRecurringExpense>('/api/organization-recurring-expense', createInput).pipe(first()).toPromise();
    }

    getAll(relations?: string[], findInput?: OrganizationRecurringExpenseFindInput): Promise<{
        items: OrganizationRecurringExpense[],
        total: number
    }> {
        const data = JSON.stringify({ relations, findInput });

        return this.http.get<{
            items: OrganizationRecurringExpense[],
            total: number
        }>('/api/organization-recurring-expense', {
            params: { data }
        }).pipe(first()).toPromise();
    }

    delete(id: string): Promise<any> {
        return this.http.delete(`/api/organization-recurring-expense/${id}`).pipe(first()).toPromise();
    }

    update(id: string, updateInput: OrganizationRecurringExpense): Promise<any> {
        return this.http.put(`/api/organization-recurring-expense/${id}`, updateInput).pipe(first()).toPromise();
    }
}