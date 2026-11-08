import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { BaseQueryDTO } from '../../../core/crud';
import { DailyPlan } from '../daily-plan.entity';

/** The shapes a daily plan list can be asked in. */
export const DAILY_PLAN_SHAPES = ['full', 'lean'] as const;
export type DailyPlanShape = (typeof DAILY_PLAN_SHAPES)[number];

/**
 * The query of the daily plan list routes: the usual find options plus `shape`.
 *
 * `shape=lean` keeps the plans and their tasks and trims the people (`employee`, `tasks.members` and their users) to
 * the ids, the name and the avatar fields a client shows (see `daily-plan.lean.ts`). The default, `full`, is the
 * answer as before.
 */
export class DailyPlanQueryDTO extends BaseQueryDTO<DailyPlan> {
	@ApiPropertyOptional({ enum: DAILY_PLAN_SHAPES, default: 'full' })
	@IsOptional()
	@IsIn(DAILY_PLAN_SHAPES)
	readonly shape?: DailyPlanShape;
}
