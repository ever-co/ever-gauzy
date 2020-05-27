import { IHelpCenter } from '@gauzy/models';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable()
export class HelpCenterService {
	constructor(private http: HttpClient) {}

	create(createInput: IHelpCenter): Promise<IHelpCenter> {
		return this.http
			.post<IHelpCenter>('/api/help-center', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(): Promise<{ items: any[]; total: number }> {
		return this.http
			.get<{ items: IHelpCenter[]; total: number }>(`/api/help-center`)
			.pipe(first())
			.toPromise();
	}
	update(updateInput: any): Promise<any> {
		return this.http
			.put('/api/help-center', updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/help-center/${id}`)
			.pipe(first())
			.toPromise();
	}
}
