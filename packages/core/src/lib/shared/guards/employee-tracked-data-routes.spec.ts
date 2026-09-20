/**
 * 🛑 These two imports must stay FIRST, before anything that pulls a core controller — see the note in
 * `mutating-route-permissions.spec.ts`: entering the entity graph from the controller end leaves
 * `IsEmployeeBelongsToOrganization` half-initialized and the suite fails to load.
 */
import 'reflect-metadata';
import '../../core/entities/internal';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ActivityController } from '../../time-tracking/activity/activity.controller';
import { CustomTrackingController } from '../../time-tracking/custom-tracking/custom-tracking.controller';
import { StatisticController } from '../../time-tracking/statistic/statistic.controller';
import { TimeLogController } from '../../time-tracking/time-log/time-log.controller';
import { TimeSlotController } from '../../time-tracking/time-slot/time-slot.controller';
import { EmployeeTrackedDataGuard } from './employee-tracked-data.guard';

/**
 * The organization setting `allowEmployeeToSeeTrackedData` is only enforced where
 * {@link EmployeeTrackedDataGuard} is actually attached, and dropping a `@UseGuards` line is an
 * invisible change in review. This suite pins both halves of that decision:
 *
 * - every read route that returns tracked data carries the guard;
 * - the routes that must keep working while the setting is off do NOT carry it — the desktop timer's
 *   sync and recording calls (`time-slot/:id`, `time-log/:id`, `time-log/conflict`, the task picker's
 *   `POST statistics/tasks`) and every write route.
 *
 * The media plugins (videos, camshot, soundshot) live outside this package and are covered by their own
 * controllers' decorators.
 */
interface RouteDescriptor {
	name: string;
	method: RequestMethod;
	path: string;
	handler: (...args: any[]) => any;
}

function collectRoutes(controller: Function): RouteDescriptor[] {
	const routes = new Map<string, RouteDescriptor>();
	let prototype = controller.prototype;

	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (name === 'constructor' || routes.has(name)) {
				continue;
			}
			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
			if (!descriptor || typeof descriptor.value !== 'function') {
				continue;
			}
			const method: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, descriptor.value);
			if (method === undefined) {
				continue;
			}
			routes.set(name, {
				name,
				method,
				path: Reflect.getMetadata(PATH_METADATA, descriptor.value),
				handler: descriptor.value
			});
		}
		prototype = Object.getPrototypeOf(prototype);
	}

	return [...routes.values()];
}

function isGuarded(controller: Function, route: RouteDescriptor): boolean {
	const guards: Function[] = [
		...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
		...(Reflect.getMetadata(GUARDS_METADATA, route.handler) ?? [])
	];
	return guards.includes(EmployeeTrackedDataGuard);
}

/** Handler names that must carry the guard, per controller. */
const GUARDED: [Function, string, string[]][] = [
	[ActivityController, 'ActivityController', ['getActivities', 'getDailyActivities', 'getDailyActivitiesReport']],
	[
		StatisticController,
		'StatisticController',
		[
			'getCountsStatistics',
			'getMembersStatistics',
			'getProjectsStatistics',
			'getManualTimesStatistics',
			'getEmployeeTimeSlotsStatistics',
			'getActivitiesStatistics'
		]
	],
	[
		TimeLogController,
		'TimeLogController',
		[
			'getDailyReport',
			'getDailyReportChartData',
			'getOwedAmountReport',
			'getOwedAmountReportChartData',
			'getWeeklyReport',
			'getTimeLimitReport',
			'getProjectBudgetLimit',
			'clientBudgetLimit',
			'getLogs'
		]
	],
	[TimeSlotController, 'TimeSlotController', ['findAll']],
	[
		CustomTrackingController,
		'CustomTrackingController',
		['getTrackingSessions', 'getTimeSlotTrackingData', 'getSessionsBySessionId', 'getActiveSessions']
	]
];

/** Handler names that must stay exempt, with the reason they are. */
const EXEMPT: [Function, string, Record<string, string>][] = [
	[
		TimeLogController,
		'TimeLogController',
		{
			findById: 'desktop offline sync reads its own log by id',
			getConflict: 'manual-time overlap check while adding time'
		}
	],
	[TimeSlotController, 'TimeSlotController', { findById: 'desktop screenshot retry queue reads its own slot by id' }],
	[
		StatisticController,
		'StatisticController',
		{
			getTasksStatistics: "the desktop timer's task picker",
			getTrackedDataAccess: 'it answers whether this guard would block the caller'
		}
	]
];

describe('EmployeeTrackedDataGuard route coverage', () => {
	describe.each(GUARDED)('%#. guarded reads', (controller, controllerName, handlers) => {
		it.each(handlers)(`${controllerName}.%s is guarded`, (handler) => {
			const route = collectRoutes(controller).find((it) => it.name === handler);
			expect(route).toBeDefined();
			expect(isGuarded(controller, route)).toBe(true);
		});
	});

	describe.each(EXEMPT)('%#. exempt routes', (controller, controllerName, handlers) => {
		it.each(Object.entries(handlers))(`${controllerName}.%s stays exempt (%s)`, (handler) => {
			const route = collectRoutes(controller).find((it) => it.name === handler);
			expect(route).toBeDefined();
			expect(isGuarded(controller, route)).toBe(false);
		});
	});

	it('classifies every read route, so a new one cannot be left unguarded by accident', () => {
		const classified = new Set([
			...GUARDED.flatMap(([, , handlers]) => handlers),
			...EXEMPT.flatMap(([, , handlers]) => Object.keys(handlers))
		]);
		const controllers = new Map<Function, string>([...GUARDED, ...EXEMPT].map(([c, n]) => [c, n]));
		const unclassified: string[] = [];

		for (const [controller, controllerName] of controllers) {
			for (const route of collectRoutes(controller)) {
				if (route.method === RequestMethod.GET && !classified.has(route.name)) {
					unclassified.push(`${controllerName}.${route.name}`);
				}
			}
		}

		// Add the handler to GUARDED, or to EXEMPT with the reason it may stay open
		expect(unclassified).toEqual([]);
	});

	it('never guards a write route: recording must keep working while the setting is off', () => {
		const writeMethods = new Set([
			RequestMethod.POST,
			RequestMethod.PUT,
			RequestMethod.PATCH,
			RequestMethod.DELETE
		]);
		const guardedWrites: string[] = [];

		for (const [controller, controllerName] of [...GUARDED, ...EXEMPT].map(
			([c, n]) => [c, n] as [Function, string]
		)) {
			for (const route of collectRoutes(controller)) {
				if (writeMethods.has(route.method) && isGuarded(controller, route)) {
					guardedWrites.push(`${controllerName}.${route.name}`);
				}
			}
		}

		expect(guardedWrites).toEqual([]);
	});
});
