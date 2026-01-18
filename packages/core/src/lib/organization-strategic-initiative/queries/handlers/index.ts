import { OrganizationStrategicInitiativeFindAllHandler } from './organization-strategic-initiative.find-all.handler';
import { OrganizationStrategicInitiativeFindOneHandler } from './organization-strategic-initiative.find-one.handler';
import { OrganizationStrategicInitiativeFindByProjectHandler } from './organization-strategic-initiative.find-by-project.handler';

export const QueryHandlers = [
	OrganizationStrategicInitiativeFindAllHandler,
	OrganizationStrategicInitiativeFindOneHandler,
	OrganizationStrategicInitiativeFindByProjectHandler
];
