import { OrganizationStrategicInitiativeCreateHandler } from './organization-strategic-initiative.create.handler';
import { OrganizationStrategicInitiativeUpdateHandler } from './organization-strategic-initiative.update.handler';
import { OrganizationStrategicInitiativeUpdateSignalsHandler } from './organization-strategic-initiative.update-signals.handler';

export const CommandHandlers = [
	OrganizationStrategicInitiativeCreateHandler,
	OrganizationStrategicInitiativeUpdateHandler,
	OrganizationStrategicInitiativeUpdateSignalsHandler
];
