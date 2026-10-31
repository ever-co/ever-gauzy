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
		const goalService = { createGoal: jest.fn(), delete: jest.fn(async () => ({ affected: 1 })) };
		goalService.createGoal.mockImplementation(async (goal: { name: string }) => ({
			id: `goal-new-${++goalCount}`,
			name: goal.name
		}));
		const goalSettingsService = { createKPI: jest.fn(), deleteKPI: jest.fn(async () => ({ affected: 1 })) };
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

	it('builds the whole objective from the preset chosen when creation started, even if another is picked meanwhile', async () => {
		const { component, goalService, goalSettingsService, keyResultService } = build();
		// The user goes back and picks another preset while the KPI request is pending
		goalSettingsService.createKPI.mockImplementationOnce(async () => {
			component.selectedGoalTemplate = { ...preset(), name: 'Another preset', keyResults: [] };
			return { id: 'kpi-new-1' };
		});

		await component.createGoal();

		expect(goalService.createGoal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Grow the website' }));
		expect(keyResultService.createBulkKeyResult.mock.calls[0][0]).toHaveLength(2);
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

	/**
	 * #11601 review of #3912 / #4825: a preset is saved in several requests, KPIs first. When a later one fails, what
	 * the attempt created is removed again, so no KPI is orphaned and trying again does not create a second set.
	 */
	describe('when a later step fails', () => {
		/** A preset with two KPI key results and a numerical one. */
		const twoKpiPreset = () => {
			const template = preset();
			return {
				...template,
				keyResults: [
					template.keyResults[0],
					{
						...template.keyResults[0],
						id: 'kr-template-kpi-2',
						name: 'Convert 50 visitors',
						kpi: { ...template.keyResults[0].kpi, id: 'kpi-template-id-2', name: 'Monthly signups' }
					},
					template.keyResults[1]
				]
			};
		};

		const consoleError = () => jest.spyOn(console, 'error').mockImplementation(() => undefined);
		afterEach(() => jest.restoreAllMocks());

		it('removes the KPIs already created when a later KPI cannot be created', async () => {
			const { component, goalService, goalSettingsService, keyResultService, toastrService } = build();
			component.selectedGoalTemplate = twoKpiPreset();
			goalSettingsService.createKPI
				.mockImplementationOnce(async () => ({ id: 'kpi-new-1' }))
				.mockImplementationOnce(async () => {
					throw new Error('refused');
				});

			await component.createGoal();

			expect(goalSettingsService.deleteKPI.mock.calls).toEqual([['kpi-new-1']]);
			expect(toastrService.error).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_CREATION_FAILED');
			expect(goalService.createGoal).not.toHaveBeenCalled();
			expect(keyResultService.createBulkKeyResult).not.toHaveBeenCalled();
			expect(toastrService.warning).not.toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_PRESET_ROLLBACK_FAILED');
		});

		it('removes the KPIs when the objective cannot be created', async () => {
			consoleError();
			const { component, goalService, goalSettingsService, toastrService } = build();
			component.selectedGoalTemplate = twoKpiPreset();
			goalService.createGoal.mockRejectedValueOnce(new Error('Http failure response'));

			await component.createGoal();

			// Newest first
			expect(goalSettingsService.deleteKPI.mock.calls).toEqual([['kpi-new-2'], ['kpi-new-1']]);
			expect(goalService.delete).not.toHaveBeenCalled();
			expect(toastrService.error).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_CREATION_ERROR');
			expect(component.dialogRef.close).not.toHaveBeenCalled();
		});

		it('removes the KPIs when the objective request answers with nothing', async () => {
			const { component, goalService, goalSettingsService, toastrService } = build();
			goalService.createGoal.mockResolvedValueOnce(null);

			await component.createGoal();

			expect(goalSettingsService.deleteKPI.mock.calls).toEqual([['kpi-new-1']]);
			expect(toastrService.error).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_CREATION_FAILED');
		});

		it('removes the objective, then its KPIs, when the key results cannot be created', async () => {
			consoleError();
			const { component, goalService, goalSettingsService, keyResultService, toastrService } = build();
			const removed: string[] = [];
			goalService.delete.mockImplementation(async (id: string) => removed.push(id));
			goalSettingsService.deleteKPI.mockImplementation(async (id: string) => removed.push(id));
			keyResultService.createBulkKeyResult.mockRejectedValueOnce(new Error('Http failure response'));

			await component.createGoal();

			// The objective first: its key results go with it, and they link to the KPI
			expect(removed).toEqual(['goal-new-1', 'kpi-new-1']);
			expect(toastrService.error).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_CREATION_ERROR');
			expect(toastrService.success).not.toHaveBeenCalledWith('TOASTR.MESSAGE.KEY_RESULTS_CREATED');
			expect(component.dialogRef.close).not.toHaveBeenCalled();
		});

		it('removes the objective and its KPIs when the key results request answers with nothing', async () => {
			const { component, goalService, goalSettingsService, keyResultService, toastrService } = build();
			keyResultService.createBulkKeyResult.mockResolvedValueOnce(null);

			await component.createGoal();

			expect(goalService.delete.mock.calls).toEqual([['goal-new-1']]);
			expect(goalSettingsService.deleteKPI.mock.calls).toEqual([['kpi-new-1']]);
			expect(toastrService.error).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_CREATION_FAILED');
			expect(component.dialogRef.close).not.toHaveBeenCalled();
		});

		it('names the records it could not remove, after trying every one', async () => {
			consoleError();
			const { component, goalService, goalSettingsService, keyResultService, toastrService } = build();
			component.selectedGoalTemplate = twoKpiPreset();
			component.getTranslation = jest.fn((key: string) => key);
			goalService.delete.mockRejectedValueOnce(new Error('offline'));
			goalSettingsService.deleteKPI
				.mockResolvedValueOnce({ affected: 1 }) // the second KPI, removed first
				.mockRejectedValueOnce(new Error('offline'));
			keyResultService.createBulkKeyResult.mockRejectedValueOnce(new Error('Http failure response'));

			await component.createGoal();

			expect(goalSettingsService.deleteKPI).toHaveBeenCalledTimes(2);
			expect(component.getTranslation).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_PRESET_ROLLBACK_FAILED', {
				names: 'Monthly visitors, Grow the website'
			});
			expect(toastrService.warning).toHaveBeenCalledWith('TOASTR.MESSAGE.GOAL_PRESET_ROLLBACK_FAILED');
		});

		it('leaves exactly one set of records after a failed attempt and a successful retry', async () => {
			consoleError();
			const { component, goalService, goalSettingsService, keyResultService } = build();
			keyResultService.createBulkKeyResult.mockRejectedValueOnce(new Error('Http failure response'));

			await component.createGoal();
			await component.createGoal();

			const kpisLeft =
				goalSettingsService.createKPI.mock.calls.length - goalSettingsService.deleteKPI.mock.calls.length;
			const goalsLeft = goalService.createGoal.mock.calls.length - goalService.delete.mock.calls.length;
			expect({ kpisLeft, goalsLeft }).toEqual({ kpisLeft: 1, goalsLeft: 1 });
			expect(keyResultService.createBulkKeyResult.mock.calls[1][0][0]).toEqual(
				expect.objectContaining({ goalId: 'goal-new-2', kpiId: 'kpi-new-2' })
			);
			expect(component.dialogRef.close).toHaveBeenCalledWith('done');
		});

		it('removes nothing when every step succeeds', async () => {
			const { component, goalService, goalSettingsService } = build();

			await component.createGoal();

			expect(goalService.delete).not.toHaveBeenCalled();
			expect(goalSettingsService.deleteKPI).not.toHaveBeenCalled();
		});
	});
});
