import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TimeTrackerQuery } from '../../../../time-tracker/+state/time-tracker.query';
import { NoteSelectorQuery } from './note-selector.query';
import { NoteSelectorStore } from './note-selector.store';

@Injectable({
	providedIn: 'root'
})
export class NoteService {
	constructor(
		private readonly query: NoteSelectorQuery,
		private readonly store: NoteSelectorStore,
		private readonly timeTrackerQuery: TimeTrackerQuery
	) {}

	public get note(): string {
		return this.query.note;
	}

	public set note(note: string) {
		this.store.update({ note });
	}

	public get disabled$(): Observable<boolean> {
		return this.timeTrackerQuery.disabled$;
	}
}
