import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Expense,
  ExpenseCreateInput as IExpenseCreateInput
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
  
}
