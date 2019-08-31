import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    Income,
    IncomeCreateInput as IIncomeCreateInput,
    IncomeFindInput as IIncomeFindInput,
    IncomeUpdateInput as IIncomeUpdateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()

export class IncomeService {

    constructor(private http: HttpClient) { }

    create(createInput: IIncomeCreateInput): Promise<Income> {
        return this.http.post<Income>('/api/income/create', createInput).pipe(first()).toPromise();
    }

    getAll(relations?: string[], findInput?: IIncomeFindInput, filterDate?: Date): Promise<{ items: Income[], total: number }> {
        const data = JSON.stringify({ relations, findInput, filterDate });

        return this.http.get<{ items: Income[], total: number }>(`/api/income`, {
            params: { data }
        }).pipe(first()).toPromise();
    }

    update(id: string, updateInput: IIncomeUpdateInput): Promise<any> {
        return this.http.put(`/api/income/${id}`, updateInput).pipe(first()).toPromise();
    }

    delete(id: string): Promise<any> {
        return this.http.delete(`/api/income/${id}`).pipe(first()).toPromise();
    }
}
