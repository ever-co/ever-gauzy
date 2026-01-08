export * from './system-setting.get.command';
export * from './system-setting.save.command';

import { SystemSettingGetHandler, SystemSettingGetByScopeHandler } from './handlers/system-setting.get.handler';
import { SystemSettingSaveHandler } from './handlers/system-setting.save.handler';

export const CommandHandlers = [SystemSettingGetHandler, SystemSettingGetByScopeHandler, SystemSettingSaveHandler];
