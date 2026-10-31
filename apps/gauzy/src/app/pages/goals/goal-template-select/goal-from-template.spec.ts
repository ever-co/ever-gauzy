import { GoalLevelEnum, IGoalKPITemplate, IKeyResultTemplate, KeyResultTypeEnum } from '@gauzy/contracts';
import {
	buildGoalFromTemplate,
	buildKeyResultFromTemplate,
	buildKpiFromTemplate,
	goalOwnerField,
	keyResultOwnerId
} from './goal-from-template';

/**
 * #4825 — "Create from Preset" spread the template rows into its create payloads, ids and all.
 */
describe('goal-from-template (#4825)', () => {
	const scope = { organizationId: 'org-1', tenantId: 'tenant-1' };
	/** What a template row carries besides its content: identity, timestamps and its own scope. */
	const templateRow = {
		id: 'template-id',
		createdAt: new Date('2024-01-01'),
		updatedAt: new Date('2024-01-02'),
		organizationId: 'template-org',
		tenantId: 'template-tenant'
	};
	const kpiTemplate = {
		...templateRow,
		id: 'kpi-template-id',
		name: 'Monthly visitors',
		description: 'Unique visitors per month',
		type: 'Numerical',
		unit: 'visitors',
		operator: '>=',
		currentValue: 10,
		targetValue: 1000
	} as IGoalKPITemplate;
	const keyResultTemplate = {
		...templateRow,
		id: 'key-result-template-id',
		name: 'Reach 1000 visitors',
		type: KeyResultTypeEnum.KPI,
		unit: 'visitors',
		initialValue: 10,
		targetValue: 1000,
		deadline: 'No Custom Deadline',
		goalId: 'template-id',
		kpiId: 'kpi-template-id',
		kpi: kpiTemplate
	} as unknown as IKeyResultTemplate;
	const identityKeys = ['id', 'createdAt', 'updatedAt'];

	describe('buildGoalFromTemplate', () => {
		const template = { ...templateRow, name: 'Grow the website', level: 'Team', category: 'Marketing', keyResults: [] };
		const form = { deadline: 'Q1', level: GoalLevelEnum.TEAM, ownerId: 'team-1', leadId: 'employee-lead' };

		it('copies no identity, timestamps, scope, category or key results of the template', () => {
			const goal = buildGoalFromTemplate(template, form, scope);

			identityKeys.forEach((key) => expect(goal).not.toHaveProperty(key));
			expect(goal).not.toHaveProperty('category');
			expect(goal).not.toHaveProperty('keyResults');
			expect(goal).toEqual({
				name: 'Grow the website',
				description: ' ',
				level: GoalLevelEnum.TEAM,
				deadline: 'Q1',
				leadId: 'employee-lead',
				progress: 0,
				ownerTeamId: 'team-1',
				organizationId: 'org-1',
				tenantId: 'tenant-1'
			});
		});

		it('sets the owner column the level calls for', () => {
			expect(buildGoalFromTemplate(template, { ...form, level: GoalLevelEnum.EMPLOYEE }, scope)).toMatchObject({
				ownerEmployeeId: 'team-1'
			});
			const organizationGoal = buildGoalFromTemplate(
				template,
				{ ...form, level: GoalLevelEnum.ORGANIZATION, ownerId: 'org-1' },
				scope
			);
			expect(organizationGoal).not.toHaveProperty('ownerEmployeeId');
			expect(organizationGoal).not.toHaveProperty('ownerTeamId');
			expect(organizationGoal.organizationId).toBe('org-1');
		});

		it('leaves the lead out when none was chosen', () => {
			expect(buildGoalFromTemplate(template, { ...form, leadId: null }, scope)).not.toHaveProperty('leadId');
		});

		it('maps each level to its owner column', () => {
			expect(goalOwnerField(GoalLevelEnum.EMPLOYEE)).toBe('ownerEmployeeId');
			expect(goalOwnerField(GoalLevelEnum.TEAM)).toBe('ownerTeamId');
			expect(goalOwnerField(GoalLevelEnum.ORGANIZATION)).toBeNull();
		});
	});

	describe('buildKpiFromTemplate', () => {
		it('creates the KPI in the selected organization, without the template id', () => {
			const kpi = buildKpiFromTemplate(kpiTemplate, scope);

			identityKeys.forEach((key) => expect(kpi).not.toHaveProperty(key));
			expect(kpi).toEqual({
				name: 'Monthly visitors',
				description: 'Unique visitors per month',
				type: 'Numerical',
				unit: 'visitors',
				operator: '>=',
				currentValue: 10,
				targetValue: 1000,
				organizationId: 'org-1',
				tenantId: 'tenant-1'
			});
		});

		it('starts the current value at zero when the template leaves it out', () => {
			expect(buildKpiFromTemplate({ ...kpiTemplate, currentValue: undefined }, scope).currentValue).toBe(0);
		});
	});

	describe('buildKeyResultFromTemplate', () => {
		it('attaches the key result to the new objective, owner and KPI, never to the template ones', () => {
			const keyResult = buildKeyResultFromTemplate(
				keyResultTemplate,
				{ goalId: 'goal-new', ownerId: 'employee-1', kpiId: 'kpi-new' },
				scope
			);

			identityKeys.forEach((key) => expect(keyResult).not.toHaveProperty(key));
			expect(keyResult).not.toHaveProperty('kpi');
			expect(keyResult).not.toHaveProperty('goal');
			expect(keyResult).toEqual({
				name: 'Reach 1000 visitors',
				type: KeyResultTypeEnum.KPI,
				unit: 'visitors',
				initialValue: 10,
				targetValue: 1000,
				update: 10,
				deadline: 'No Custom Deadline',
				hardDeadline: undefined,
				softDeadline: undefined,
				description: ' ',
				progress: 0,
				status: 'none',
				weight: '1',
				kpiId: 'kpi-new',
				goalId: 'goal-new',
				ownerId: 'employee-1',
				organizationId: 'org-1',
				tenantId: 'tenant-1'
			});
		});

		it("does not fall back to the template's KPI when no KPI was created", () => {
			const keyResult = buildKeyResultFromTemplate(
				keyResultTemplate,
				{ goalId: 'goal-new', ownerId: 'employee-1' },
				scope
			);
			expect(keyResult).not.toHaveProperty('kpiId');
		});
	});

	describe('keyResultOwnerId', () => {
		it('is the owning employee of an employee objective', () => {
			expect(
				keyResultOwnerId({ deadline: 'Q1', level: GoalLevelEnum.EMPLOYEE, ownerId: 'employee-owner', leadId: 'lead' }, 'me')
			).toBe('employee-owner');
		});

		it('is the lead, then the current employee, of a team or organization objective — never the team or organization', () => {
			const team = { deadline: 'Q1', level: GoalLevelEnum.TEAM, ownerId: 'team-1' };
			expect(keyResultOwnerId({ ...team, leadId: 'lead' }, 'me')).toBe('lead');
			expect(keyResultOwnerId({ ...team, leadId: null }, 'me')).toBe('me');
			expect(keyResultOwnerId({ ...team, level: GoalLevelEnum.ORGANIZATION, ownerId: 'org-1' }, 'me')).toBe('me');
		});

		it('is null when no employee is known', () => {
			expect(keyResultOwnerId({ deadline: 'Q1', level: GoalLevelEnum.ORGANIZATION, ownerId: 'org-1' }, null)).toBeNull();
		});
	});
});
