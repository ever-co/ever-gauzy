import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { INoteSelectorState, NoteSelectorStore } from './note-selector.store';

@Injectable({ providedIn: 'root' })
export class NoteSelectorQuery extends Query<INoteSelectorState> {
	constructor(protected store: NoteSelectorStore) {
		super(store);
	}

	public get note(): string {
		return this.getValue().note;
	}

	public get note$(): Observable<string> {
		return this.select((state) => state.note);
	}
}
