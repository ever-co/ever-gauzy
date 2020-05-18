import { IntegrationSettingGetHandler } from './integration-setting.get.handler';
import { IntegrationSettingGetManyHandler } from './integration-setting.getMany.handler';
import { IntegrationSettingCreateHandler } from './integration-setting.create.handler';

export const CommandHandlers = [
	IntegrationSettingGetHandler,
	IntegrationSettingGetManyHandler,
	IntegrationSettingCreateHandler
];
