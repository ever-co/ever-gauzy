import { Injectable } from '@angular/core';
import { NoteSelectorQuery } from './note-selector.query';
import { NoteSelectorStore } from './note-selector.store';

@Injectable({
	providedIn: 'root'
})
export class NoteService {
	constructor(private readonly query: NoteSelectorQuery, private readonly store: NoteSelectorStore) {}

	public get note(): string {
		return this.query.note;
	}

	public set note(note: string) {
		this.store.update({ note });
	}
}
