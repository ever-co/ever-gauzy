import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { NoteSelectorQuery } from './+state/note-selector.query';
import { NoteSelectorStore } from './+state/note-selector.store';
import { NoteService } from './+state/note.service';

@Component({
	selector: 'gauzy-note',
	templateUrl: './note.component.html',
	styleUrls: ['./note.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoteComponent {
	constructor(
		private readonly electronService: ElectronService,
		public readonly noteSelectorStore: NoteSelectorStore,
		public readonly noteSelectorQuery: NoteSelectorQuery,
		public readonly noteSelectorService: NoteService
	) {}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public get note$(): Observable<string> {
		return this.noteSelectorQuery.note$;
	}

	public change(note: string) {
		this.noteSelectorStore.update({ note });
	}

	public get disabled$(): Observable<boolean> {
		return this.noteSelectorService.disabled$;
	}
}
