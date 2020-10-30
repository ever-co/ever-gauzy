import { CreateJobPresetHandler } from './create-job-preset.handler';
import { SaveEmployeeCriterionHandler } from './save-employee-criterion.handler';
import { SaveEmployeePresetHandler } from './save-employee-preset.handler';
import { SavePresetCriterionHandler } from './save-preset-criterion.handler';

export const Handlers = [
	CreateJobPresetHandler,
	SavePresetCriterionHandler,
	SaveEmployeePresetHandler,
	SaveEmployeeCriterionHandler
];
