import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Income } from '@gauzy/models';
import {
  IncomeCreateInput as IIncomeCreateInput,
  IncomeFindInput as IIncomeFindInput
} from '@gauzy/models';

@Injectable()

export class IncomeService {

  constructor(private http: HttpClient) { }

  create(createInput: IIncomeCreateInput): Observable<Income> {
    return this.http.post<Income>('/api/income/create', createInput);
  }

  getAll(relations?: string[], findInput?: IIncomeFindInput): Observable<{ items: Income[], total: number }> {
    const data = JSON.stringify({ relations, findInput });
    return this.http.get<{ items: Income[], total: number }>(`/api/income`, {
        params: { data }
    });
}
}
