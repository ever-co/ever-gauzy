import '../core/entities/internal';

import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { DailyPlanController } from '../tasks/daily-plan/daily-plan.controller';
import { TaskController } from '../tasks/task.controller';
import { ActivityController } from '../time-tracking/activity/activity.controller';
import { StatisticController } from '../time-tracking/statistic/statistic.controller';
import { StatisticResolver } from '../time-tracking/statistic/statistic.resolver';
import { TimeLogController } from '../time-tracking/time-log/time-log.controller';
import { TimeSlotController } from '../time-tracking/time-slot/time-slot.controller';
import { TimerController } from '../time-tracking/timer/timer.controller';
import { HIDDEN_PROJECT_ROWS, HiddenProjectsInterceptor } from './hidden-projects.interceptor';

/**
 * CORE-27 (ever-co/ever-gauzy#12031): the routes whose records name a project withhold the projects the caller may not
 * see: time entries and their history, reports and charts, slots, activities, statistics, tasks, daily plans and the
 * timer status.
 */
describe('the routes that withhold hidden projects', () => {
	it.each([
		['time entries, their history and reports', TimeLogController],
		['time slots', TimeSlotController],
		['activities', ActivityController],
		['statistics', StatisticController],
		['the timer status', TimerController],
		['tasks', TaskController],
		['daily plans', DailyPlanController]
	])('%s', (_records, controller) => {
		expect(Reflect.getMetadata(INTERCEPTORS_METADATA, controller)).toContain(HiddenProjectsInterceptor);
	});

	it('reads the statistic of projects as a list of projects, keeping their tracked time', () => {
		expect(Reflect.getMetadata(HIDDEN_PROJECT_ROWS, StatisticController.prototype.getProjectsStatistics)).toEqual({
			rootRowsAreProjects: { keep: ['duration', 'durationPercentage'] }
		});
	});

	it('withholds hidden projects from the statistics over GraphQL as over REST', () => {
		expect(Reflect.getMetadata(INTERCEPTORS_METADATA, StatisticResolver)).toContain(HiddenProjectsInterceptor);
		expect(Reflect.getMetadata(HIDDEN_PROJECT_ROWS, StatisticResolver.prototype.timeTrackingProjects)).toEqual({
			rootRowsAreProjects: { keep: ['duration', 'durationPercentage'] }
		});
	});

	it('withholds the budget of a hidden project from the budget report, keeping the time spent', () => {
		expect(Reflect.getMetadata(HIDDEN_PROJECT_ROWS, TimeLogController.prototype.getProjectBudgetLimit)).toEqual({
			withheldWithProject: ['budgetType', 'budget', 'remainingBudget', 'spentPercentage']
		});
	});
});
