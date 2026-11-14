import { TaskAutomationLinkClosure } from './task-automation-link-closure.entity';
import { TaskAutomationRule } from './task-automation-rule.entity';
import { TaskAutomationRun } from './task-automation-run.entity';

export * from './task-automation-link-closure.entity';
export * from './task-automation-rule.entity';
export * from './task-automation-run.entity';

/** Every table the plugin owns (its migrations create them). */
export const TASK_AUTOMATION_ENTITIES = [TaskAutomationRule, TaskAutomationRun, TaskAutomationLinkClosure];
