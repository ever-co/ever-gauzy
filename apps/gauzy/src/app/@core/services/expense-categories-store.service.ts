import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IExpenseCategory } from '@gauzy/models';
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

	loadAll(): void {
		this.expenseCategoriesService
			.getAll()
			.pipe(tap(({ items }) => this._expenseCategories$.next(items)))
			.subscribe();
	}

	create(name): Observable<IExpenseCategory> {
		return this.expenseCategoriesService
			.create({ name })
			.pipe(
				tap((expenseCategory) =>
					this._expenseCategories$.next([
						...this.expenseCategories,
						expenseCategory
					])
				)
			);
	}
}
