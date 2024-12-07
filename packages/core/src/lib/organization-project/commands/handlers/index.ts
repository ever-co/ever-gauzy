import { OrganizationProjectCreateHandler } from './organization-project-create.handler';
import { OrganizationProjectEditByEmployeeHandler } from './organization-project-edit-by-employee.handler';
import { OrganizationProjectSettingUpdateHandler } from './organization-project-setting.update.handler';
import { OrganizationProjectUpdateHandler } from './organization-project-update.handler';

export const CommandHandlers = [
	OrganizationProjectCreateHandler,
	OrganizationProjectEditByEmployeeHandler,
	OrganizationProjectSettingUpdateHandler,
	OrganizationProjectUpdateHandler,
];
