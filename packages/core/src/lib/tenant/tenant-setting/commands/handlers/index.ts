import { TenantSettingGetHandler } from './tenant-setting.get.handler';
import { TenantSettingSaveHandler } from './tenant-setting.save.handler';
import { GlobalSettingGetHandler } from './global-setting.get.handler';
import { GlobalSettingSaveHandler } from './global-setting.save.handler';

export const CommandHandlers = [
	TenantSettingGetHandler,
	TenantSettingSaveHandler,
	GlobalSettingGetHandler,
	GlobalSettingSaveHandler
];
