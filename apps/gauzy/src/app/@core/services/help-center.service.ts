import { IHelpCenter, IHelpCenterFind } from '@gauzy/contracts';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterService {
	constructor(private http: HttpClient) {}

	create(createInput: IHelpCenter): Promise<IHelpCenter> {
		return firstValueFrom(
			this.http
			.post<IHelpCenter>(`${API_PREFIX}/help-center`, createInput)
		);
	}

	getAll(
		relations?: string[],
		findInput?: IHelpCenterFind
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<{ items: IHelpCenter[]; total: number }>(
				`${API_PREFIX}/help-center`,
				{
					params: { data }
				}
			)
		);
	}

	updateBulk(
		oldChildren: IHelpCenter[],
		newChildren: IHelpCenter[]
	): Promise<IHelpCenter[]> {
		return firstValueFrom(
			this.http
			.post<IHelpCenter[]>(`${API_PREFIX}/help-center/updateBulk`, {
				oldChildren,
				newChildren
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/help-center/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/help-center/${id}`)
		);
	}

	findByBaseId(parentId: string): Promise<IHelpCenter[]> {
		return firstValueFrom(
			this.http
			.get<IHelpCenter[]>(`${API_PREFIX}/help-center/base/${parentId}`)
		);
	}

	deleteBulkByBaseId(parentId: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/help-center/base/${parentId}`)
		);
	}
}
