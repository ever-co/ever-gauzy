import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IIncome, IIncomeCreateInput, IIncomeFindInput, IIncomeUpdateInput, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IncomeService {
	constructor(private readonly http: HttpClient) {}

	create(createInput: IIncomeCreateInput): Promise<IIncome> {
		return firstValueFrom(this.http.post<IIncome>(`${API_PREFIX}/income`, createInput));
	}

	getMyAll(relations?: string[], findInput?: IIncomeFindInput, filterDate?: Date): Promise<IPagination<IIncome>> {
		const data = JSON.stringify({ relations, findInput, filterDate });
		return firstValueFrom(
			this.http.get<IPagination<IIncome>>(`${API_PREFIX}/income/me`, {
				params: { data }
			})
		);
	}

	getAll(relations?: string[], findInput?: IIncomeFindInput, filterDate?: Date): Promise<IPagination<IIncome>> {
		const data = JSON.stringify({ relations, findInput, filterDate });
		return firstValueFrom(
			this.http.get<IPagination<IIncome>>(`${API_PREFIX}/income`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: IIncomeUpdateInput): Promise<IIncome> {
		return firstValueFrom(this.http.put<IIncome>(`${API_PREFIX}/income/${id}`, updateInput));
	}

	delete(incomeId: string, input: IIncomeFindInput): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/income/${incomeId}`, {
				params: toParams({ ...input })
			})
		);
	}
}
