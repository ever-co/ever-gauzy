import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IExpenseCategory, IExpenseCategoryFind } from '@gauzy/contracts';
import { tap } from 'rxjs/operators';
import { ExpenseCategoriesService } from './expense-categories.service';

@Injectable({
	providedIn: 'root'
})
export class ExpenseCategoriesStoreService {
	private _expenseCategories$: BehaviorSubject<
		IExpenseCategory[]
	> = new BehaviorSubject([]);
	public expenseCategories$: Observable<
		IExpenseCategory[]
	> = this._expenseCategories$.asObservable();

	get expenseCategories(): IExpenseCategory[] {
		return this._expenseCategories$.getValue();
	}

	constructor(private expenseCategoriesService: ExpenseCategoriesService) {}

	loadAll(where: IExpenseCategoryFind): void {
		this.expenseCategoriesService
			.getAll(where)
			.pipe(tap(({ items }) => this._expenseCategories$.next(items)))
			.subscribe();
	}

	create(category: IExpenseCategory): Observable<IExpenseCategory> {
		return this.expenseCategoriesService
			.create(category)
			.pipe(
				tap((category: IExpenseCategory) =>
					this._expenseCategories$.next([
						...this.expenseCategories,
						category
					])
				)
			);
	}
}
