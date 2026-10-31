import {
	GoalLevelEnum,
	ID,
	IGoal,
	IGoalKPITemplate,
	IGoalTemplate,
	IKeyResult,
	IKeyResultTemplate,
	IKPI,
	KeyResultUpdateStatusEnum,
	KeyResultWeightEnum
} from '@gauzy/contracts';

/**
 * The payloads "Create from Preset" sends, built field by field from a goal template.
 *
 * A template, its key results and their KPIs are rows of their own tables, with their own ids. Spread into a
 * create payload, those ids went along: `POST /goals`, `POST /goal-kpi` and `POST /key-results/bulk` save the id
 * they are given (create is an upsert), so using a preset a second time rewrote the goal, KPIs and key results the
 * first use had created (#4825). Each builder below copies only the fields the new record takes and names its
 * organization and tenant, so nothing of the template's identity, timestamps or scope reaches the request.
 */

/** The second step of the dialog: when the objective is due, at which level, and who owns and leads it. */
export interface IGoalPresetForm {
	deadline: string;
	level: GoalLevelEnum | string;
	/** The employee, team or organization that owns the objective, by level. */
	ownerId: ID;
	leadId?: ID | null;
}

/** The organization and tenant every record created from the preset belongs to. */
export interface IGoalPresetScope {
	organizationId: ID;
	tenantId: ID;
}

/** The objective's owner column for a level; an organization objective is owned through `organizationId`. */
export function goalOwnerField(level: GoalLevelEnum | string): 'ownerEmployeeId' | 'ownerTeamId' | null {
	switch (level) {
		case GoalLevelEnum.EMPLOYEE:
			return 'ownerEmployeeId';
		case GoalLevelEnum.TEAM:
			return 'ownerTeamId';
		default:
			return null;
	}
}

/**
 * The employee who owns the key results created from the preset. A key result's owner is always an employee
 * (`key_result.ownerId` references `employee`), but the objective's owner is a team or the organization at those
 * levels, and passing that id failed the whole creation. So: the owning employee at employee level, otherwise the
 * objective's lead, otherwise the employee creating it.
 *
 * @returns The employee id, or `null` when no employee is known (the dialog then asks for a lead).
 */
export function keyResultOwnerId(form: IGoalPresetForm, currentEmployeeId?: ID | null): ID | null {
	if (form.level === GoalLevelEnum.EMPLOYEE) {
		return form.ownerId || null;
	}
	return form.leadId || currentEmployeeId || null;
}

/** The objective to create from a template and the dialog's form. */
export function buildGoalFromTemplate(
	template: Pick<IGoalTemplate, 'name'>,
	form: IGoalPresetForm,
	scope: IGoalPresetScope
): Partial<IGoal> {
	const goal: Partial<IGoal> = {
		name: template.name,
		// As the dialog always sent it: the preset has no description of its own
		description: ' ',
		level: form.level,
		deadline: form.deadline,
		...(form.leadId ? { leadId: form.leadId } : {}),
		progress: 0,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	};

	const ownerField = goalOwnerField(form.level);
	if (ownerField) {
		goal[ownerField] = form.ownerId;
	}
	return goal;
}

/** The KPI to create for a key result template of type KPI. */
export function buildKpiFromTemplate(kpi: IGoalKPITemplate, scope: IGoalPresetScope): Partial<IKPI> {
	return {
		name: kpi.name,
		description: kpi.description,
		type: kpi.type,
		unit: kpi.unit,
		operator: kpi.operator,
		// The KPI's current value is required; a template that leaves it out starts it at zero
		currentValue: kpi.currentValue ?? 0,
		targetValue: kpi.targetValue,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	};
}

/** Values every key result created from a preset starts with. */
const KEY_RESULT_DEFAULTS = {
	description: ' ',
	progress: 0,
	status: KeyResultUpdateStatusEnum.NONE,
	weight: KeyResultWeightEnum.DEFAULT
} as const;

/**
 * A key result to create under the new objective, from its template.
 *
 * @param template The key result template.
 * @param refs The objective created, the employee who owns the key result and, for a KPI key result, the KPI
 *   created for it (the template's own KPI id is never used).
 * @param scope The organization and tenant.
 */
export function buildKeyResultFromTemplate(
	template: IKeyResultTemplate,
	refs: { goalId: ID; ownerId: ID; kpiId?: ID },
	scope: IGoalPresetScope
): Partial<IKeyResult> & { ownerId: ID } {
	return {
		name: template.name,
		type: template.type,
		unit: template.unit,
		initialValue: template.initialValue,
		targetValue: template.targetValue,
		// The key result's progress value is required, the template's initial value is not: it then starts at zero
		update: template.initialValue ?? 0,
		deadline: template.deadline,
		hardDeadline: template.hardDeadline,
		softDeadline: template.softDeadline,
		...KEY_RESULT_DEFAULTS,
		...(refs.kpiId ? { kpiId: refs.kpiId } : {}),
		goalId: refs.goalId,
		ownerId: refs.ownerId,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	};
}
