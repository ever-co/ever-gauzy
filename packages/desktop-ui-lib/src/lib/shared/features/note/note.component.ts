import { ChangeDetectionStrategy, Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { NoteSelectorQuery } from './+state/note-selector.query';
import { NoteSelectorStore } from './+state/note-selector.store';
import { NoteService } from './+state/note.service';

@Component({
	selector: 'gauzy-note',
	templateUrl: './note.component.html',
	styleUrls: ['./note.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => NoteComponent),
			multi: true
		}
	]
})
export class NoteComponent implements ControlValueAccessor {
	private onChange: (value: string) => void;
	private onTouched: () => void;
	// Flag to control whether to update the store
	protected useStore: boolean = true;
	constructor(
		private readonly electronService: ElectronService,
		public readonly noteSelectorStore: NoteSelectorStore,
		public readonly noteSelectorQuery: NoteSelectorQuery,
		public readonly noteSelectorService: NoteService
	) {}
	writeValue(note: string): void {
		this.useStore = false;
		if (this.useStore) {
			this.noteSelectorStore.update({ note });
		}
	}

	registerOnChange(fn: (note: string) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}
	setDisabledState(disabled: boolean): void {
		this.noteSelectorStore.update({ disabled });
	}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public get note$(): Observable<string> {
		return this.noteSelectorQuery.note$;
	}

	public change(note: string) {
		if (this.useStore) {
			this.noteSelectorStore.update({ note });
		}
		this.onChange(note);
		this.onTouched();
	}

	public get disabled$(): Observable<boolean> {
		return this.noteSelectorService.disabled$;
	}
}
