/**
 * 🛑 These two imports must stay FIRST, before anything that pulls a core controller — see the note at the top
 * of `mutating-route-permissions.spec.ts`: entering the entity graph from a controller leaves a decorator module
 * half-initialized.
 */
import 'reflect-metadata';
import '../core/entities/internal';
import { RequestMethod } from '@nestjs/common';
import {
	GUARDS_METADATA,
	HTTP_CODE_METADATA,
	METHOD_METADATA,
	PATH_METADATA,
	PIPES_METADATA
} from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard } from '../shared/guards';
import { TASK_SETTING_WRITE_METADATA, TaskSettingPermissionGuard } from './task-setting-access';
import { IssueTypeController } from './issue-type/issue-type.controller';
import { IssueTypeService } from './issue-type/issue-type.service';
import { TaskPriorityController } from './priorities/priority.controller';
import { TaskPriorityService } from './priorities/priority.service';
import { TaskRelatedIssueTypeController } from './related-issue-type/related-issue-type.controller';
import { TaskRelatedIssueTypeService } from './related-issue-type/related-issue-type.service';
import { TaskSizeController } from './sizes/size.controller';
import { TaskSizeService } from './sizes/size.service';
import { TaskStatusController } from './statuses/status.controller';
import { TaskStatusService } from './statuses/status.service';
import { TaskVersionController } from './versions/version.controller';
import { TaskVersionService } from './versions/version.service';

/**
 * GHSA-v79w-54p2-wmh5, owner decision 2 (2026-10-22) — the task settings are written under `ORG_TASK_SETTING`.
 *
 * The six task-settings controllers extend `CrudFactory`, which declares `POST /`, `PUT :id` and `DELETE :id` with
 * no permission metadata, and `PermissionGuard` answers `true` to empty metadata: any signed-in member of the
 * tenant could add, change or remove the organization's statuses, priorities, sizes, versions, issue types and
 * related-issue types, reorder the status board, and move the default status or issue type. Their soft delete and
 * recover already stated `ORG_TASK_SETTING`; every other write now states it too.
 *
 * This suite reads the metadata Nest itself reads, on the most derived handler, for every mutating route each
 * controller serves — inherited ones included — and checks that each override still serves the inherited route
 * the way the base did (path, method, status code, validation).
 *
 * The guard is `TaskSettingPermissionGuard`, a `PermissionGuard` that also lets a manager of a team write the rows of
 * that team (owner decision 2(b), 2026-10-23); every write names its rows with `@TaskSettingWrite`, the controller's
 * own service and how the write names them (`task-setting-permission.guard.spec.ts` covers the decisions).
 */
const CONTROLLERS = [
	IssueTypeController,
	TaskPriorityController,
	TaskRelatedIssueTypeController,
	TaskSizeController,
	TaskStatusController,
	TaskVersionController
];

const MUTATING = new Set<RequestMethod>([
	RequestMethod.POST,
	RequestMethod.PUT,
	RequestMethod.PATCH,
	RequestMethod.DELETE
]);

/** Every route a controller serves, by handler name, walking the prototype chain the way Nest's scanner does. */
function routes(controller: Function): Map<string, { handler: Function; declaredOn: Function }> {
	const found = new Map<string, { handler: Function; declaredOn: Function }>();
	let prototype = controller.prototype;

	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
			if (name === 'constructor' || found.has(name) || typeof descriptor?.value !== 'function') {
				continue;
			}
			if (Reflect.getMetadata(METHOD_METADATA, descriptor.value) !== undefined) {
				found.set(name, { handler: descriptor.value, declaredOn: prototype.constructor });
			}
		}
		prototype = Object.getPrototypeOf(prototype);
	}

	return found;
}

/** Each controller's own service: the rows its writes name. */
const SERVICE_OF = new Map<Function, Function>([
	[IssueTypeController, IssueTypeService],
	[TaskPriorityController, TaskPriorityService],
	[TaskRelatedIssueTypeController, TaskRelatedIssueTypeService],
	[TaskSizeController, TaskSizeService],
	[TaskStatusController, TaskStatusService],
	[TaskVersionController, TaskVersionService]
]);

/** How each write names its rows, by handler name. */
const KIND_OF: Record<string, string> = {
	create: 'create',
	update: 'update',
	delete: 'stored',
	softRemove: 'stored',
	softRecover: 'stored',
	markAsDefault: 'markAsDefault',
	reorder: 'reorder'
};

/** The handler the `CrudFactory` base declares for a route, which the controller now overrides. */
function inheritedHandler(controller: Function, name: string): Function {
	return (Object.getPrototypeOf(controller.prototype) as Record<string, Function>)[name];
}

/** The body type the handler's validation pipe validates against. */
function bodyTypeOf(handler: Function): unknown {
	const pipes = (Reflect.getMetadata(PIPES_METADATA, handler) ?? []) as Array<{ targetTypes?: { body?: unknown } }>;

	return pipes.map((pipe) => pipe.targetTypes?.body).find(Boolean);
}

describe('the task-settings controllers — every write states ORG_TASK_SETTING', () => {
	it.each(CONTROLLERS.map((controller) => [controller.name, controller]))(
		'%s states ORG_TASK_SETTING behind the task-setting guard on every mutating route, inherited ones included',
		(_name, controller) => {
			const mutating = [...routes(controller)].filter(([, { handler }]) =>
				MUTATING.has(Reflect.getMetadata(METHOD_METADATA, handler))
			);

			// The five `CrudFactory` writes at least; the status and issue-type controllers serve more.
			expect(mutating.map(([name]) => name)).toEqual(
				expect.arrayContaining(['create', 'update', 'delete', 'softRemove', 'softRecover'])
			);

			expect(
				mutating.map(([name, { handler, declaredOn }]) => ({
					route: name,
					declaredOn: declaredOn.name,
					guards: Reflect.getMetadata(GUARDS_METADATA, handler),
					permissions: Reflect.getMetadata(PERMISSIONS_METADATA, handler),
					write: Reflect.getMetadata(TASK_SETTING_WRITE_METADATA, handler)
				}))
			).toEqual(
				mutating.map(([name]) => ({
					route: name,
					declaredOn: controller.name,
					guards: [TaskSettingPermissionGuard],
					permissions: [PermissionsEnum.ORG_TASK_SETTING],
					write: { rows: SERVICE_OF.get(controller), kind: KIND_OF[name] }
				}))
			);
			// The guard is still `PermissionGuard` for a holder of the grant
			expect(Object.getPrototypeOf(TaskSettingPermissionGuard)).toBe(PermissionGuard);
		}
	);

	it.each(CONTROLLERS.map((controller) => [controller.name, controller]))(
		'%s still serves create, update and delete on the inherited paths, codes and validation',
		(_name, controller) => {
			for (const name of ['create', 'update', 'delete']) {
				const override = (controller.prototype as unknown as Record<string, Function>)[name];
				const inherited = inheritedHandler(controller, name);

				// The base declares the route with no permission at all — the omission this suite closes.
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, inherited)).toBeUndefined();

				expect(override).not.toBe(inherited);
				expect(Reflect.getMetadata(METHOD_METADATA, override)).toBe(
					Reflect.getMetadata(METHOD_METADATA, inherited)
				);
				expect(Reflect.getMetadata(PATH_METADATA, override)).toBe(
					Reflect.getMetadata(PATH_METADATA, inherited)
				);
				expect(Reflect.getMetadata(HTTP_CODE_METADATA, override)).toBe(
					Reflect.getMetadata(HTTP_CODE_METADATA, inherited)
				);
				expect(bodyTypeOf(override)).toBe(bodyTypeOf(inherited));
			}
			// create and update validate their body against the controller's own DTOs, as the base did.
			expect(bodyTypeOf(controller.prototype.create)).toBeDefined();
			expect(bodyTypeOf(controller.prototype.update)).toBeDefined();
		}
	);

	it('gates the status board reorder and the two mark-as-default routes on their own paths', () => {
		const served: Array<[Function, string, RequestMethod, string]> = [
			[TaskStatusController, 'reorder', RequestMethod.PATCH, '/reorder'],
			[TaskStatusController, 'markAsDefault', RequestMethod.PUT, ':id/default'],
			[IssueTypeController, 'markAsDefault', RequestMethod.PUT, ':id/default']
		];

		for (const [controller, name, method, path] of served) {
			const handler = (controller.prototype as unknown as Record<string, Function>)[name];

			expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
			expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
			expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([TaskSettingPermissionGuard]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([PermissionsEnum.ORG_TASK_SETTING]);
			expect(Reflect.getMetadata(TASK_SETTING_WRITE_METADATA, handler)).toEqual({
				rows: SERVICE_OF.get(controller),
				kind: KIND_OF[name]
			});
		}
	});

	it('leaves every read without a permission, as before', () => {
		for (const controller of CONTROLLERS) {
			for (const [name, { handler }] of routes(controller)) {
				if (Reflect.getMetadata(METHOD_METADATA, handler) === RequestMethod.GET) {
					expect({
						route: `${controller.name}.${name}`,
						permissions: Reflect.getMetadata(PERMISSIONS_METADATA, handler)
					}).toEqual({
						route: `${controller.name}.${name}`,
						permissions: undefined
					});
				}
			}
		}
	});
});
