import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { IPluginUploadIntentState, PluginUploadIntentStore, UploadIntent } from '../stores/plugin-upload-intent.store';

@Injectable({ providedIn: 'root' })
export class PluginUploadIntentQuery extends Query<IPluginUploadIntentState> {
	/**
	 * Observable of the current upload intent
	 */
	public intent$: Observable<UploadIntent | null> = this.select((state) => state.intent);

	constructor(protected store: PluginUploadIntentStore) {
		super(store);
	}

	/**
	 * Get the current upload intent value
	 */
	public get intent(): UploadIntent | null {
		return this.getValue().intent;
	}
}
