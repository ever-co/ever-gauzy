import { UntypedFormBuilder } from '@angular/forms';
import { GoalLevelEnum, KeyResultTypeEnum } from '@gauzy/contracts';
import { GoalTemplateSelectComponent } from './goal-template-select.component';

/**
 * #4825 — "Create from Preset" sent the template's own ids with the goal, KPIs and key results it created, an
 * unset organization for the KPIs, and the objective's owner as the key results' owner even when that owner is a
 * team or the organization (`key_result.ownerId` references an employee).
 *
 * Only `createGoal` is exercised, on a bare instance with its services stubbed: no template or DI is needed.
 */
describe('GoalTemplateSelectComponent — create from preset (#4825)', () => {
	const preset = () => ({
		id: 'goal-template-id',
		createdAt: new Date('2024-01-01'),
		name: 'Grow the website',
		level: GoalLevelEnum.ORGANIZATION,
		category: 'Marketing',
		organizationId: 'org-1',
		tenantId: 'tenant-1',
		keyResults: [
			{
				id: 'kr-template-kpi',
				name: 'Reach 1000 visitors',
				type: KeyResultTypeEnum.KPI,
				initialValue: 0,
				targetValue: 1000,
				deadline: 'No Custom Deadline',
				goalId: 'goal-template-id',
				kpiId: 'kpi-template-id',
				kpi: {
					id: 'kpi-template-id',
					name: 'Monthly visitors',
					description: 'Unique visitors',
					type: 'Numerical',
					operator: '>=',
					currentValue: 0,
					targetValue: 1000
				}
			},
			{
				id: 'kr-template-number',
				name: 'Publish 10 articles',
				type: KeyResultTypeEnum.NUMERICAL,
				initialValue: 0,
				targetValue: 10,
				deadline: 'No Custom Deadline',
				goalId: 'goal-template-id'
			}
		]
	});

	const build = (options: { employeeId?: string | null; kpiFails?: boolean } = {}) => {
		const { employeeId = 'employee-me', kpiFails = false } = options;
		let goalCount = 0;
		let kpiCount = 0;
		// Untyped mocks, so `mock.calls` can be read back without casts
		const goalService = { createGoal: jest.fn() };
		goalService.createGoal.mockImplementation(async () => ({ id: `goal-new-${++goalCount}` }));
		const goalSettingsService = { createKPI: jest.fn() };
		goalSettingsService.createKPI.mockImplementation(async () => {
			if (kpiFails) throw new Error('refused');
			return { id: `kpi-new-${++kpiCount}` };
		});
		const keyResultService = { createBulkKeyResult: jest.fn() };
		keyResultService.createBulkKeyResult.mockImplementation(async (list: unknown[]) => list);
		const toastrService = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(GoalTemplateSelectComponent.prototype);
		Object.assign(component, {
			organization: { id: 'org-1', tenantId: 'tenant-1', name: 'Acme' },
			selectedGoalTemplate: preset(),
			form: GoalTemplateSelectComponent.buildForm(new UntypedFormBuilder(), component),
			store: { user: { tenantId: 'tenant-1', employee: employeeId ? { id: employeeId } : null } },
			goalService,
			goalSettingsService,
			keyResultService,
			toastrService,
			getTranslation: (key: string) => key,
			dialogRef: { close: jest.fn() }
		});
		component.form.patchValue({ deadline: 'Q1 2027', level: GoalLevelEnum.ORGANIZATION, ownerId: 'org-1' });
		return { component, goalService, goalSettingsService, keyResultService, toastrService };
	};

	const allValues = (value: unknown): unknown[] =>
		value && typeof value === 'object' ? Object.values(value).flatMap(allValues) : [value];

	it('sends no template id with the goal, the KPI or the key results', async () => {
		const { component, goalService, goalSettingsService, keyResultService } = build();

		await component.createGoal();

		const payloads = [
			...goalService.createGoal.mock.calls.map(([goal]) => goal),
			...goalSettingsService.createKPI.mock.calls.map(([kpi]) => kpi),
			...keyResultService.createBulkKeyResult.mock.calls.flatMap(([list]) => list)
		];
		expect(payloads).toHaveLength(4);
		const templateIds = ['goal-template-id', 'kr-template-kpi', 'kr-template-number', 'kpi-template-id'];
		expect(allValues(payloads).filter((value) => templateIds.includes(value as string))).toEqual([]);
		payloads.forEach((payload) => {
			expect(payload).not.toHaveProperty('id');
			expect(payload).not.toHaveProperty('createdAt');
		});
	});

	it('creates the KPI in the selected organization and links its key result to it', async () => {
		const { component, goalSettingsService, keyResultService, toastrService } = build();

		await component.createGoal();

		expect(goalSettingsService.createKPI).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Monthly visitors', organizationId: 'org-1', tenantId: 'tenant-1' })
		);
		const [[keyResults]] = keyResultService.createBulkKeyResult.mock.calls;
		expect(keyResults).toEqual([
			expect.objectContaining({ name: 'Reach 1000 visitors', goalId: 'goal-new-1', kpiId: 'kpi-new-1' }),
			expect.not.objectContaining({ kpiId: expect.anything() })
		]);
		expect(toastrService.success).toHaveBeenCalledWith('TOASTR.MESSAGE.KEY_RESULTS_CREATED');
		expect(component.dialogRef.close).toHaveBeenCalledWith('done');
	});

	it('creates a new set of records each time the same preset is used', async () => {
		const { component, goalService, keyResultService } = build();

		await component.createGoal();
		await component.createGoal();

		expect(goalService.createGoal.mock.calls[0][0]).toEqual(goalService.createGoal.mock.calls[1][0]);
		const [[first], [second]] = keyResultService.createBulkKeyResult.mock.calls;
		expect(first.map(({ goalId }) => goalId)).toEqual(['goal-new-1', 'goal-new-1']);
		expect(second.map(({ goalId }) => goalId)).toEqual(['goal-new-2', 'goal-new-2']);
		expect(second[0].kpiId).toBe('kpi-new-2');
		// The template itself is left as it was read
		expect(component.selectedGoalTemplate).toEqual(preset());
	});

	it('gives an organization objective’s key results to the lead, else to the employee creating it', async () => {
		const withLead = build();
		withLead.component.form.patchValue({ leadId: 'employee-lead' });
		await withLead.component.createGoal();
		expect(withLead.keyResultService.createBulkKeyResult.mock.calls[0][0].map(({ ownerId }) => ownerId)).toEqual([
			'employee-lead',
			'employee-lead'
		]);

		const withoutLead = build();
		await withoutLead.component.createGoal();
		expect(withoutLead.keyResultService.createBulkKeyResult.mock.calls[0][0].map(({ ownerId }) => ownerId)).toEqual(
			['employee-me', 'employee-me']
		);
	});

	it('asks for a lead, creating nothing, when no employee can own the key results', async () => {
		const { component, goalService, keyResultService, toastrService } = build({ employeeId: null });

		await component.createGoal();

		expect(toastrService.error).toHaveBeenCalledWith('TOASTR.MESSAGE.KEY_RESULTS_OWNER_REQUIRED');
		expect(goalService.createGoal).not.toHaveBeenCalled();
		expect(keyResultService.createBulkKeyResult).not.toHaveBeenCalled();
	});

	it('creates no objective or key results when a KPI cannot be created, rather than a KPI result without its KPI', async () => {
		const { component, goalService, keyResultService, toastrService } = build({ kpiFails: true });

		await component.createGoal();

		expect(toastrService.warning).toHaveBeenCalledWith('TOASTR.MESSAGE.KPI_CREATION_FAILED');
		expect(toastrService.error).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_CREATION_FAILED');
		expect(goalService.createGoal).not.toHaveBeenCalled();
		expect(keyResultService.createBulkKeyResult).not.toHaveBeenCalled();
		expect(component.dialogRef.close).not.toHaveBeenCalled();
	});
});
