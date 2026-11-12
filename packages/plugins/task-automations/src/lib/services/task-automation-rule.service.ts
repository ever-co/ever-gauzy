import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import {
	ID,
	ITaskAutomationAction,
	ITaskAutomationCondition,
	ITaskAutomationRule,
	ITaskAutomationRuleCreateInput,
	ITaskAutomationRuleUpdateInput,
	ITaskAutomationTrigger,
	TASK_AUTOMATION_LIMITS,
	TaskAutomationTriggerEnum,
	TaskPriorityEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { Employee, OrganizationProject, OrganizationTeam, RequestContext, Tag, TaskPriority, TaskStatus, UserOrganization } from '@gauzy/core';
import { TaskAutomationRule } from '../entities/task-automation-rule.entity';
import {
	normalizeActions,
	normalizeConditions,
	normalizeDescription,
	normalizeName,
	normalizeTrigger,
	referencesOf,
	TaskAutomationValidationError
} from '../engine/rule-validation';
import { templateByKey } from '../engine/templates';
import { TASK_AUTOMATION_RULE_CACHE_MS } from '../task-automation.constants';
import { ruleColumns, ruleFromRow } from './task-automation-rule.mapper';

/** The caller a route acts for: their tenant, the organization they work in, and who they are. */
export interface ITaskAutomationScope {
	tenantId: ID;
	organizationId: ID;
	userId: ID | null;
}

const lower = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/**
 * The automation rules of an organization (spec FR-1 – FR-4): read, create (blank or from a template), edit, switch,
 * reorder and delete, each held to the limits and to the organization — every status, priority, person, label,
 * project and team a rule names must be the organization's. The engine reads the enabled rules through
 * {@link enabledRules}; the change capture asks {@link enabledTriggers}, which is cached for a few seconds per
 * organization and dropped here whenever a rule of it changes.
 */
@Injectable()
export class TaskAutomationRuleService {
	private readonly triggerCache = new Map<string, { at: number; triggers: Set<string> }>();

	constructor(private readonly dataSource: DataSource) {}

	private get rules() {
		return this.dataSource.getRepository(TaskAutomationRule);
	}

	/**
	 * The caller's tenant and organization. The organization is the one the platform validated for the request (the
	 * `organization-id` header); a requested organization that is another one is refused. Without a validated one, a
	 * requested organization is taken only when the caller is a member of it.
	 */
	async callerScope(requestedOrganizationId?: ID | null): Promise<ITaskAutomationScope> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) throw new UnauthorizedException();
		const userId = RequestContext.currentUserId();
		const current = RequestContext.currentOrganizationId();
		if (requestedOrganizationId && current && requestedOrganizationId !== current) {
			throw new ForbiddenException('The organization is not the one this request works in.');
		}
		const organizationId = current ?? requestedOrganizationId ?? null;
		if (!organizationId) throw new BadRequestException('Choose an organization first.');
		if (!current) {
			const member = userId
				? await this.dataSource.getRepository(UserOrganization).findOne({
						where: { userId, organizationId, tenantId, isActive: true } as never,
						select: { id: true } as never
					})
				: null;
			if (!member) throw new ForbiddenException('The organization is not one of yours.');
		}
		return { tenantId, organizationId, userId };
	}

	/** The organization's rules in their order; optionally only those of a project or a team. */
	async list(scope: ITaskAutomationScope, filter: { projectId?: ID | null; organizationTeamId?: ID | null } = {}): Promise<ITaskAutomationRule[]> {
		const where: Record<string, unknown> = { tenantId: scope.tenantId, organizationId: scope.organizationId };
		if (filter.projectId) where['projectId'] = filter.projectId;
		if (filter.organizationTeamId) where['organizationTeamId'] = filter.organizationTeamId;
		const rows = await this.rules.find({ where: where as never, order: { position: 'ASC', createdAt: 'ASC' } as never });
		return rows.map(ruleFromRow);
	}

	/** One rule of the organization; another organization's is not found. */
	async get(scope: ITaskAutomationScope, id: ID): Promise<ITaskAutomationRule> {
		return ruleFromRow(await this.row(scope, id));
	}

	private async row(scope: ITaskAutomationScope, id: ID): Promise<TaskAutomationRule> {
		const row = await this.rules.findOne({ where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as never });
		if (!row) throw new NotFoundException('The automation rule was not found.');
		return row;
	}

	/** A new rule, at the end of the organization's order. A template fills what the body leaves out. */
	async create(scope: ITaskAutomationScope, input: ITaskAutomationRuleCreateInput): Promise<ITaskAutomationRule> {
		const template = input.templateKey ? templateByKey(input.templateKey) : undefined;
		if (input.templateKey && !template) throw new BadRequestException('The template is not one the platform knows.');
		const count = await this.rules.count({ where: { tenantId: scope.tenantId, organizationId: scope.organizationId } as never });
		if (count >= TASK_AUTOMATION_LIMITS.rulesPerOrganization) {
			throw new BadRequestException(`An organization holds at most ${TASK_AUTOMATION_LIMITS.rulesPerOrganization} automation rules.`);
		}
		const rule = this.validated({
			name: input.name ?? template?.name,
			description: input.description !== undefined ? input.description : (template?.description ?? null),
			trigger: input.trigger ?? template?.trigger,
			conditions: input.conditions ?? template?.conditions ?? [],
			actions: input.actions ?? template?.actions
		});
		const projectId = input.projectId ?? null;
		const organizationTeamId = input.organizationTeamId ?? null;
		await this.checkReferences(scope, { ...rule, projectId, organizationTeamId });
		const last = await this.rules.findOne({
			where: { tenantId: scope.tenantId, organizationId: scope.organizationId } as never,
			order: { position: 'DESC' } as never,
			select: { id: true, position: true } as never
		});
		const saved = await this.rules.save(
			this.rules.create({
				tenantId: scope.tenantId,
				organizationId: scope.organizationId,
				name: rule.name,
				description: rule.description,
				projectId: projectId ?? undefined,
				organizationTeamId: organizationTeamId ?? undefined,
				isEnabled: input.isEnabled ?? !template?.needsInput,
				position: (last?.position ?? -1) + 1,
				templateKey: template?.key ?? null,
				...ruleColumns(rule)
			} as Partial<TaskAutomationRule>)
		);
		this.invalidate(scope.organizationId);
		return this.get(scope, saved.id as ID);
	}

	/**
	 * Edits a rule: only the fields the body states change, and only those are written, so two edits of different
	 * fields at once do not undo each other (the rule is validated whole, with the stored values for the rest).
	 */
	async update(scope: ITaskAutomationScope, id: ID, input: ITaskAutomationRuleUpdateInput): Promise<ITaskAutomationRule> {
		const current = ruleFromRow(await this.row(scope, id));
		const rule = this.validated({
			name: input.name !== undefined ? input.name : current.name,
			description: input.description !== undefined ? input.description : current.description,
			trigger: input.trigger !== undefined ? input.trigger : current.trigger,
			conditions: input.conditions !== undefined ? input.conditions : current.conditions,
			actions: input.actions !== undefined ? input.actions : current.actions
		});
		const projectId = input.projectId !== undefined ? input.projectId : (current.projectId ?? null);
		const organizationTeamId = input.organizationTeamId !== undefined ? input.organizationTeamId : (current.organizationTeamId ?? null);
		await this.checkReferences(scope, { ...rule, projectId, organizationTeamId });
		const columns = ruleColumns(rule);
		const changed: Record<string, unknown> = {
			...(input.name !== undefined ? { name: rule.name } : {}),
			...(input.description !== undefined ? { description: rule.description } : {}),
			...(input.projectId !== undefined ? { projectId } : {}),
			...(input.organizationTeamId !== undefined ? { organizationTeamId } : {}),
			...(input.isEnabled !== undefined ? { isEnabled: !!input.isEnabled } : {}),
			...(input.trigger !== undefined ? { triggerType: columns.triggerType, triggerConfig: columns.triggerConfig } : {}),
			...(input.conditions !== undefined ? { conditions: columns.conditions } : {}),
			...(input.actions !== undefined ? { actions: columns.actions } : {})
		};
		if (Object.keys(changed).length) {
			await this.rules.update({ id, tenantId: scope.tenantId, organizationId: scope.organizationId } as never, changed as never);
		}
		this.invalidate(scope.organizationId);
		return this.get(scope, id);
	}

	/** Puts the organization's rules in a new order: the ids named come first, in their order; the rest keep theirs. */
	async reorder(scope: ITaskAutomationScope, ids: ID[]): Promise<ITaskAutomationRule[]> {
		const all = await this.list(scope);
		const named = [...new Set((ids ?? []).map(String))];
		const unknown = named.filter((id) => !all.some((rule) => rule.id === id));
		if (unknown.length) throw new NotFoundException('An automation rule of the new order was not found.');
		const ordered = [...named, ...all.map((rule) => rule.id as string).filter((id) => !named.includes(id))];
		await this.dataSource.transaction(async (manager) => {
			for (const [position, id] of ordered.entries()) {
				await manager.getRepository(TaskAutomationRule).update({ id, tenantId: scope.tenantId, organizationId: scope.organizationId } as never, {
					position
				} as never);
			}
		});
		this.invalidate(scope.organizationId);
		return this.list(scope);
	}

	/** Deletes a rule with its runs (the run table's foreign key cascades; deleted here too for SQLite without keys). */
	async remove(scope: ITaskAutomationScope, id: ID): Promise<{ id: ID; deleted: true }> {
		const row = await this.row(scope, id);
		await this.dataSource.transaction(async (manager) => {
			await manager.query(
				`DELETE FROM ${this.quote('task_automation_run')} WHERE ${this.quote('ruleId')} = ${this.param(1)}`,
				[row.id]
			);
			await manager.getRepository(TaskAutomationRule).delete({ id: row.id, tenantId: scope.tenantId } as never);
		});
		this.invalidate(scope.organizationId);
		return { id: row.id as ID, deleted: true };
	}

	/** The rules of an organization that are on, in their order (the engine's read). */
	async enabledRules(tenantId: ID, organizationId: ID): Promise<ITaskAutomationRule[]> {
		const rows = await this.rules.find({
			where: { tenantId, organizationId, isEnabled: true } as never,
			order: { position: 'ASC', createdAt: 'ASC' } as never
		});
		return rows.map(ruleFromRow);
	}

	/** Every rule that is on with a trigger, across tenants, in their order (the due-date sweep's read). */
	async enabledRulesOfTrigger(trigger: TaskAutomationTriggerEnum): Promise<ITaskAutomationRule[]> {
		const rows = await this.rules.find({
			where: { triggerType: trigger, isEnabled: true } as never,
			order: { organizationId: 'ASC', position: 'ASC' } as never
		});
		return rows.map(ruleFromRow);
	}

	/** The triggers of an organization's rules that are on (cached a few seconds; the capture asks on every task save). */
	async enabledTriggers(tenantId: ID, organizationId: ID, now = Date.now()): Promise<Set<string>> {
		const cached = this.triggerCache.get(organizationId);
		if (cached && now - cached.at < TASK_AUTOMATION_RULE_CACHE_MS) return cached.triggers;
		const rows = await this.rules.find({
			where: { tenantId, organizationId, isEnabled: true } as never,
			select: { id: true, triggerType: true } as never
		});
		const triggers = new Set(rows.map((row) => String(row.triggerType)));
		this.triggerCache.set(organizationId, { at: now, triggers });
		if (this.triggerCache.size > 5_000) {
			for (const [key, entry] of this.triggerCache) {
				if (now - entry.at >= TASK_AUTOMATION_RULE_CACHE_MS) this.triggerCache.delete(key);
			}
		}
		return triggers;
	}

	/** Forgets what the capture knows of an organization's rules (a rule of it changed in this process). */
	invalidate(organizationId: ID): void {
		this.triggerCache.delete(organizationId);
	}

	/** Records when a rule last ran. */
	async touchLastRun(ruleId: ID, at: Date): Promise<void> {
		await this.rules.update({ id: ruleId } as never, { lastRunAt: at } as never);
	}

	/** The structural checks of a rule (types, values, sizes); `400` with the reason. */
	private validated(input: {
		name: unknown;
		description: unknown;
		trigger: unknown;
		conditions: unknown;
		actions: unknown;
	}): { name: string; description: string | null; trigger: ITaskAutomationTrigger; conditions: ITaskAutomationCondition[]; actions: ITaskAutomationAction[] } {
		try {
			return {
				name: normalizeName(input.name),
				description: normalizeDescription(input.description),
				trigger: normalizeTrigger(input.trigger),
				conditions: normalizeConditions(input.conditions),
				actions: normalizeActions(input.actions)
			};
		} catch (error) {
			if (error instanceof TaskAutomationValidationError) throw new BadRequestException(error.message);
			throw error;
		}
	}

	/**
	 * Every project, team, status, priority, person and label a rule names must be the organization's (spec FR-4). A
	 * status or a priority may also be one of the platform's default values (`done`, `high`), which every
	 * organization has whether or not it keeps rows for them.
	 */
	private async checkReferences(
		scope: ITaskAutomationScope,
		rule: {
			trigger: ITaskAutomationTrigger;
			conditions: ITaskAutomationCondition[];
			actions: ITaskAutomationAction[];
			projectId: ID | null;
			organizationTeamId: ID | null;
		}
	): Promise<void> {
		const { tenantId, organizationId } = scope;
		const own = { tenantId, organizationId } as never;
		if (rule.projectId) {
			const project = await this.dataSource.getRepository(OrganizationProject).findOne({
				where: { id: rule.projectId, ...(own as object) } as never,
				select: { id: true } as never
			});
			if (!project) throw new BadRequestException('The project is not one of the organization.');
		}
		if (rule.organizationTeamId) {
			const team = await this.dataSource.getRepository(OrganizationTeam).findOne({
				where: { id: rule.organizationTeamId, ...(own as object) } as never,
				select: { id: true } as never
			});
			if (!team) throw new BadRequestException('The team is not one of the organization.');
		}
		const refs = referencesOf(rule);
		// A rule of one project names that project's own statuses and priorities or the organization's, never another
		// project's (which it could not resolve on its tasks); a rule of the whole organization may name any.
		const usable = (row: { projectId?: string | null }) => !rule.projectId || !row.projectId || row.projectId === rule.projectId;
		if (refs.statuses.length) {
			const rows = await this.dataSource.getRepository(TaskStatus).find({
				where: [
					{ tenantId, organizationId },
					{ tenantId, organizationId: IsNull() }
				] as never
			});
			const known = new Set<string>([
				...(Object.values(TaskStatusEnum) as string[]),
				...rows.filter(usable).flatMap((row) => [lower(row.id), lower(row.value), lower(row.name)])
			]);
			const missing = refs.statuses.filter((status) => !known.has(lower(status)));
			if (missing.length) throw new BadRequestException(`The status "${missing[0]}" is not one of the organization.`);
		}
		if (refs.priorities.length) {
			const rows = await this.dataSource.getRepository(TaskPriority).find({
				where: [
					{ tenantId, organizationId },
					{ tenantId, organizationId: IsNull() }
				] as never
			});
			const known = new Set<string>([
				...(Object.values(TaskPriorityEnum) as string[]),
				...rows.filter(usable).flatMap((row) => [lower(row.id), lower(row.value), lower(row.name)])
			]);
			const missing = refs.priorities.filter((priority) => !known.has(lower(priority)));
			if (missing.length) throw new BadRequestException(`The priority "${missing[0]}" is not one of the organization.`);
		}
		if (refs.employeeIds.length) {
			const rows = await this.dataSource.getRepository(Employee).find({
				where: { id: In(refs.employeeIds), tenantId, organizationId } as never,
				select: { id: true } as never
			});
			if (rows.length !== refs.employeeIds.length) {
				throw new BadRequestException('A person the rule names is not an employee of the organization.');
			}
		}
		if (refs.tagIds.length) {
			const rows = await this.dataSource.getRepository(Tag).find({
				where: [
					{ id: In(refs.tagIds), tenantId, organizationId },
					{ id: In(refs.tagIds), tenantId, organizationId: IsNull() }
				] as never,
				select: { id: true } as never
			});
			if (new Set(rows.map((row) => row.id)).size !== refs.tagIds.length) {
				throw new BadRequestException('A label the rule names is not one of the organization.');
			}
		}
	}

	private quote(name: string): string {
		const type = String(this.dataSource.options.type);
		return type === 'mysql' || type === 'mariadb' ? `\`${name}\`` : `"${name}"`;
	}

	private param(n: number): string {
		return String(this.dataSource.options.type) === 'postgres' ? `$${n}` : '?';
	}
}
