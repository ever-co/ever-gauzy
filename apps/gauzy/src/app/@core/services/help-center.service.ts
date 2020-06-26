import { IHelpCenter } from '@gauzy/models';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterService {
	constructor(private http: HttpClient) {}

	create(createInput: IHelpCenter): Promise<IHelpCenter> {
		return this.http
			.post<IHelpCenter>('/api/help-center', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(relations?: string[]): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations });
		return this.http
			.get<{ items: IHelpCenter[]; total: number }>(`/api/help-center`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	createBulk(
		oldChildren: IHelpCenter[],
		newChildren: IHelpCenter[]
	): Promise<IHelpCenter[]> {
		return this.http
			.post<IHelpCenter[]>('/api/help-center/createBulk', {
				oldChildren,
				newChildren
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/help-center/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/help-center/${id}`)
			.pipe(first())
			.toPromise();
	}
	deleteBulk(id: string): Promise<any> {
		return this.http
			.delete(`/api/help-center/deleterBulk/${id}`)
			.pipe(first())
			.toPromise();
	}
}
