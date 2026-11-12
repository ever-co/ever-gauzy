import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
	ID,
	ITaskAutomationRule,
	ITaskAutomationRun,
	ITaskAutomationTemplate,
	ITaskAutomationTestResult,
	PermissionsEnum
} from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import {
	TaskAutomationListQueryDTO,
	TaskAutomationOrganizationDTO,
	TaskAutomationReorderDTO,
	TaskAutomationRuleCreateDTO,
	TaskAutomationRuleUpdateDTO,
	TaskAutomationRunsQueryDTO,
	TaskAutomationTestDTO
} from './dto/task-automation.dto';
import { TASK_AUTOMATION_TEMPLATES } from './engine/templates';
import { TaskAutomationEngine } from './services/task-automation-engine.service';
import { TaskAutomationRuleService } from './services/task-automation-rule.service';
import { TaskAutomationRunStore } from './services/task-automation-run.store';
import { TASK_AUTOMATION_ROUTE_PREFIX } from './task-automation.constants';

/**
 * `/api/task-automations` (plan §7): the automation rules of the caller's organization. Every route needs
 * `TASK_AUTOMATION_MANAGE` (the Settings page is a manager's); a rule of another organization or tenant is `404`.
 * Answers are `Cache-Control: no-store`.
 */
@ApiTags('Task automations')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TASK_AUTOMATION_MANAGE)
@Controller(TASK_AUTOMATION_ROUTE_PREFIX)
export class TaskAutomationController {
	constructor(
		private readonly rules: TaskAutomationRuleService,
		private readonly engine: TaskAutomationEngine,
		private readonly runs: TaskAutomationRunStore
	) {}

	@Get('/templates')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The built-in automation templates.' })
	templates(): readonly ITaskAutomationTemplate[] {
		return TASK_AUTOMATION_TEMPLATES;
	}

	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: "The organization's automation rules, in their order." })
	async list(@Query() query: TaskAutomationListQueryDTO): Promise<ITaskAutomationRule[]> {
		const scope = await this.rules.callerScope(query.organizationId);
		return this.rules.list(scope, { projectId: query.projectId, organizationTeamId: query.organizationTeamId });
	}

	@Put('/order')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: "Put the organization's rules in a new order." })
	async reorder(@Body() body: TaskAutomationReorderDTO): Promise<ITaskAutomationRule[]> {
		const scope = await this.rules.callerScope(body.organizationId);
		return this.rules.reorder(scope, body.ids);
	}

	@Get('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'One automation rule.' })
	async get(@Param('id', UUIDValidationPipe) id: ID, @Query() query: TaskAutomationOrganizationDTO): Promise<ITaskAutomationRule> {
		return this.rules.get(await this.rules.callerScope(query.organizationId), id);
	}

	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Create an automation rule, blank or from a template.' })
	async create(@Body() body: TaskAutomationRuleCreateDTO): Promise<ITaskAutomationRule> {
		const { organizationId, ...input } = body;
		return this.rules.create(await this.rules.callerScope(organizationId), input);
	}

	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Edit an automation rule (only the fields stated change).' })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() body: TaskAutomationRuleUpdateDTO): Promise<ITaskAutomationRule> {
		const { organizationId, ...input } = body;
		return this.rules.update(await this.rules.callerScope(organizationId), id, input);
	}

	@Delete('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Delete an automation rule with its run history.' })
	async remove(@Param('id', UUIDValidationPipe) id: ID, @Query() query: TaskAutomationOrganizationDTO): Promise<{ id: ID; deleted: true }> {
		return this.rules.remove(await this.rules.callerScope(query.organizationId), id);
	}

	@Post('/:id/test')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'What the rule would do to a task (nothing is written).' })
	async test(@Param('id', UUIDValidationPipe) id: ID, @Body() body: TaskAutomationTestDTO): Promise<ITaskAutomationTestResult> {
		const rule = await this.rules.get(await this.rules.callerScope(body.organizationId), id);
		return this.engine.dryRun(rule, body.taskId);
	}

	@Get('/:id/runs')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: "The rule's last runs, newest first." })
	async history(@Param('id', UUIDValidationPipe) id: ID, @Query() query: TaskAutomationRunsQueryDTO): Promise<ITaskAutomationRun[]> {
		const rule = await this.rules.get(await this.rules.callerScope(query.organizationId), id);
		return this.runs.history(rule.id as ID, query.limit);
	}
}
