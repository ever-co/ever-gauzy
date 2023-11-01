import { IntegrationSettingCreateHandler } from './integration-setting.create.handler';
import { IntegrationSettingGetHandler } from './integration-setting.get.handler';
import { IntegrationSettingGetManyHandler } from './integration-setting.getMany.handler';
import { IntegrationSettingUpdateHandler } from './integration-setting.update.handler';

export const CommandHandlers = [
	IntegrationSettingCreateHandler,
	IntegrationSettingGetHandler,
	IntegrationSettingGetManyHandler,
	IntegrationSettingUpdateHandler,
];
