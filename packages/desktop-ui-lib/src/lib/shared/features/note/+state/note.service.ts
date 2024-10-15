import { Injectable } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
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
		return combineLatest([this.timeTrackerQuery.disabled$, this.query.select((s) => s.disabled)]).pipe(
			map(([disabled, noteDisabled]) => disabled || noteDisabled)
		);
	}

	public setError<T>(error: T): void {
		this.store.setError(error);
	}

	public get selected(): string {
		return this.note;
	}
}
