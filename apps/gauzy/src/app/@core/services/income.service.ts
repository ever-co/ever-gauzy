import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Income,
  IncomeCreateInput as IIncomeCreateInput,
  IncomeFindInput as IIncomeFindInput,
  IncomeUpdateInput as IIncomeUpdateInput
} from '@gauzy/models';

@Injectable()

export class IncomeService {

  constructor(private http: HttpClient) { }

  create(createInput: IIncomeCreateInput): Observable<Income> {
    return this.http.post<Income>('/api/income/create', createInput);
  }

  getAll(relations?: string[], findInput?: IIncomeFindInput): Observable<{ items: Income[], total: number }> {
    const data = JSON.stringify({ relations, findInput });
    return this.http.get<{ items: Income[], total: number }>('/api/income', {
      params: { data }
    });
  }

  update(id: string, updateInput: IIncomeUpdateInput) {
    return this.http.put(`/api/income/${id}`, updateInput);
  }

  delete(id: string) {
    return this.http.delete(`/api/income/${id}`);
  }
}
