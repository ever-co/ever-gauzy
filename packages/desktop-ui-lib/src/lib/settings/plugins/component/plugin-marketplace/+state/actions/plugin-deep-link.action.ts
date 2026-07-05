import { createAction } from '@ngneat/effects';
import type { IDeepLinkInstallPayload } from '../../../../services/plugin-deep-link.service';

export class PluginDeepLinkActions {
	public static install = createAction('[Plugin Deep Link] Install', (payload?: IDeepLinkInstallPayload) => ({ ...payload }));
}
