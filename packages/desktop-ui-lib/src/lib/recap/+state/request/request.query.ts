import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { IRequestState, RequestStore } from './request.store';

@Injectable({ providedIn: 'root' })
export class RequestQuery extends Query<IRequestState> {
	public readonly request$: Observable<IRequestState> = this.select();
	constructor(protected store: RequestStore) {
		super(store);
	}

	public get request() {
		return this.getValue();
	}
}
