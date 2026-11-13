import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeatureFlag } from '@gauzy/common';
import { ID, ITaskAutomationRule, ITaskAutomationRun, ITaskAutomationTemplate, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_GRAPHQL, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { TaskAutomationListQueryDTO, TaskAutomationOrganizationDTO, TaskAutomationRunsQueryDTO } from '../dto/task-automation.dto';
import { TASK_AUTOMATION_TEMPLATES } from '../engine/templates';
import { TaskAutomationRuleService } from '../services/task-automation-rule.service';
import { TaskAutomationRunStore } from '../services/task-automation-run.store';

/**
 * Runs the REST route's own DTO rules on GraphQL arguments (GraphQL runs no `ValidationPipe`); members the DTO does
 * not declare are dropped, as the route's `whitelist` does.
 */
export async function validatedTaskAutomationInput<T extends object>(type: new () => T, value: object | null | undefined): Promise<T> {
	const dto = plainToInstance(type, value ?? {});
	const errors = await validate(dto, { whitelist: true, forbidUnknownValues: false });
	if (errors.length) {
		throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})));
	}
	return dto;
}

/**
 * The task automations over GraphQL: the read routes of `/api/task-automations`, one query each, reaching the same
 * service methods with the same caller scope. Guards and permission are the controller's (`TASK_AUTOMATION_MANAGE`),
 * plus the GraphQL capability gate every resolver carries (`FEATURE_GRAPHQL`).
 */
@Resolver('TaskAutomationRule')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.TASK_AUTOMATION_MANAGE)
export class TaskAutomationResolver {
	constructor(
		private readonly rules: TaskAutomationRuleService,
		private readonly runs: TaskAutomationRunStore
	) {}

	/** `GET /task-automations`. */
	@Query('taskAutomationRules')
	@Permissions(PermissionsEnum.TASK_AUTOMATION_MANAGE)
	async taskAutomationRules(
		@Args('organizationId') organizationId?: ID,
		@Args('projectId') projectId?: ID,
		@Args('organizationTeamId') organizationTeamId?: ID
	): Promise<ITaskAutomationRule[]> {
		const query = await validatedTaskAutomationInput(TaskAutomationListQueryDTO, { organizationId, projectId, organizationTeamId });
		const scope = await this.rules.callerScope(query.organizationId);
		return this.rules.list(scope, { projectId: query.projectId, organizationTeamId: query.organizationTeamId });
	}

	/** `GET /task-automations/:id`. */
	@Query('taskAutomationRule')
	@Permissions(PermissionsEnum.TASK_AUTOMATION_MANAGE)
	async taskAutomationRule(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID
	): Promise<ITaskAutomationRule> {
		const query = await validatedTaskAutomationInput(TaskAutomationOrganizationDTO, { organizationId });
		return this.rules.get(await this.rules.callerScope(query.organizationId), id);
	}

	/** `GET /task-automations/:id/runs`. */
	@Query('taskAutomationRuns')
	@Permissions(PermissionsEnum.TASK_AUTOMATION_MANAGE)
	async taskAutomationRuns(
		@Args('ruleId', UUIDValidationPipe) ruleId: ID,
		@Args('organizationId') organizationId?: ID,
		@Args('limit') limit?: number
	): Promise<ITaskAutomationRun[]> {
		const query = await validatedTaskAutomationInput(TaskAutomationRunsQueryDTO, { organizationId, limit });
		const rule = await this.rules.get(await this.rules.callerScope(query.organizationId), ruleId);
		return this.runs.history(rule.id as ID, query.limit);
	}

	/** `GET /task-automations/templates`. */
	@Query('taskAutomationTemplates')
	@Permissions(PermissionsEnum.TASK_AUTOMATION_MANAGE)
	taskAutomationTemplates(): readonly ITaskAutomationTemplate[] {
		return TASK_AUTOMATION_TEMPLATES;
	}
}
