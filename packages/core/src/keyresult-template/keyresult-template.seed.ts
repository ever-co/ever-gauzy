import { Connection } from 'typeorm';
import { ITenant, KeyResultTypeEnum } from '@gauzy/contracts';
import { KeyResultTemplate } from './keyresult-template.entity';
import { GoalTemplate } from '../goal-template/goal-template.entity';
import { GoalKPITemplate } from '../goal-kpi-template/goal-kpi-template.entity';
import * as faker from 'faker';
import { DEFAULT_KEY_RESULT_TEMPLATES } from './default-keyresult-templates';

export const createDefaultKeyResultTemplates = async (
	connection: Connection,
	tenant: ITenant
): Promise<KeyResultTemplate[]> => {
	const defaultKeyResultTemplates = [];
	const goalTemplates: GoalTemplate[] = await connection.manager.find(
		GoalTemplate
	);
	const goalKPITemplates: GoalKPITemplate[] = await connection.manager.find(
		GoalKPITemplate
	);
	if (goalTemplates && goalTemplates.length > 0) {
		goalTemplates.forEach((goal) => {
			const keyResultsOfGoal = DEFAULT_KEY_RESULT_TEMPLATES.find(
				(goalData) => goalData.name === goal.name
			);
			keyResultsOfGoal.keyResults.forEach(async (keyResultData) => {
				const keyResult = new KeyResultTemplate();
				keyResult.type = keyResultData.type;

				if (keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
					keyResult.initialValue = 0;
					keyResult.targetValue = 1;
				} else {
					if (keyResult.type === KeyResultTypeEnum.KPI) {
						keyResult.kpi = faker.random.arrayElement(
							goalKPITemplates
						);
					}
					keyResult.initialValue = keyResultData.initialValue;
					keyResult.targetValue = keyResultData.targetValue;
				}
				keyResult.unit = keyResultData.unit;
				keyResult.name = keyResultData.name;
				keyResult.deadline = keyResultData.deadline;
				keyResult.goal = goal;
				keyResult.organizationId = goal.organizationId;
				keyResult.tenant = tenant;
				defaultKeyResultTemplates.push(keyResult);
			});
		});

		return await insertDefaultKeyResults(
			connection,
			defaultKeyResultTemplates
		);
	}
};

const insertDefaultKeyResults = async (
	connection: Connection,
	defaultKeyResults: KeyResultTemplate[]
): Promise<KeyResultTemplate[]> => {
	return await connection.manager.save(defaultKeyResults);
};
