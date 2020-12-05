import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { KeyResultTypeEnum } from '@gauzy/models';
import { KeyResultTemplate } from './keyresult-template.entity';
import { GoalTemplate } from '../goal-template/goal-template.entity';
import { GoalKPITemplate } from '../goal-kpi-template/goal-kpi-template.entity';
import * as faker from 'faker';

const keyResultTemplateDefaultData = [
	{
		name: 'Improve product performance',
		level: 'Organization',
		keyResults: [
			{
				name: 'Get over 10000 new signups',
				type: 'Numerical',
				targetValue: 10000,
				initialValue: 0,
				unit: 'signups',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name: 'Publish product reviews in over 50 publications',
				type: 'Numerical',
				targetValue: 50,
				initialValue: 0,
				unit: 'publications',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			}
		]
	},
	{
		name: 'Successfully launch version 2 of our main product',
		level: 'Organization',
		keyResults: [
			{
				name:
					'Reduce the average response time on the app to less than 500ms',
				type: 'KPI',
				targetValue: 500,
				initialValue: 1000,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			}
		]
	},
	{
		name: 'Redesign and launch our new landing page',
		level: 'Team',
		keyResults: [
			{
				name:
					'Design new version of our site structure, navigation and all pages',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name:
					'Conduct stakeholder interviews with 10 people from sales and marketing',
				type: 'Numerical',
				targetValue: 10,
				initialValue: 0,
				unit: 'interviews',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name: 'With development and marketing, launch by September 1st',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'Hard Deadline',
				hardDeadline: '2020-08-31T18:30:00.000Z',
				softDeadline: null
			},
			{
				name: 'User-test page prototypes on 10 people',
				type: 'Numerical',
				targetValue: 10,
				initialValue: 0,
				unit: 'people',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name:
					'Test existing landing page and sub-pages on external users for understanding issues',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			}
		]
	},
	{
		name: 'Increase quality of releases and make sure they are timely',
		level: 'Team',
		keyResults: [
			{
				name:
					'Reduce the number of priority bugs found in production to be less than 2',
				type: 'KPI',
				targetValue: 2,
				initialValue: 15,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name: 'Increase unit test coverage to 75% from current 45%',
				type: 'Numerical',
				targetValue: 45,
				initialValue: 75,
				unit: '%',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			}
		]
	},
	{
		name: 'Identify problems with current user interface',
		level: 'Employee',
		keyResults: [
			{
				name: 'Learn new skills to enhance creativity',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name: 'Provide solution to reduce time Lag by 85%',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name:
					'Identify areas where the product lags in more than 20% cases',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			},
			{
				name: 'Test all features in real time',
				description: '',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null
			}
		]
	}
];

export const createDefaultKeyResultTemplates = async (
	connection: Connection,
	tenant: Tenant
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
			const keyResultsOfGoal = keyResultTemplateDefaultData.find(
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
