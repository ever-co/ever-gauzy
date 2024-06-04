import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IIncome, IIncomeCreateInput, IIncomeFindInput, IIncomeUpdateInput, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
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
