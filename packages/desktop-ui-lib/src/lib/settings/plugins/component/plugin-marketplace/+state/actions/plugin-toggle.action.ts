import { createAction } from '@ngneat/effects';
import { IPluginToggleState } from '../stores/plugin-toggle.store';

export class PluginToggleActions {
	public static toggle = createAction('[Plugin] Toggle Version', (state: IPluginToggleState) => state);
}
