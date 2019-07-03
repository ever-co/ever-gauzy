import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Income } from '@gauzy/models';
import { IncomeCreateInput as IIncomeCreateInput } from '@gauzy/models';

@Injectable()

export class IncomeService {

  constructor(private http: HttpClient) { }

  create(createInput: IIncomeCreateInput): Observable<Income> {
    return this.http.post<Income>('/api/income/create', createInput);
  }
}
