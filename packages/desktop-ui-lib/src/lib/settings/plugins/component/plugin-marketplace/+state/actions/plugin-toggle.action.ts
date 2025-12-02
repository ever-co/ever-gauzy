import { ID } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';
import { IPluginToggleState } from '../stores/plugin-toggle.store';

export class PluginToggleActions {
	public static toggle = createAction('[Plugin] Toggle Version', (state: IPluginToggleState) => state);
	public static auto = createAction('[Plugin] Toggle Auto', (pluginId: ID) => ({
		pluginId
	}));
}
