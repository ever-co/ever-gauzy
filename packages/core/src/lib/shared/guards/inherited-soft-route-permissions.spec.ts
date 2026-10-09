/**
 * 🛑 These two imports must stay FIRST, before anything that pulls a core controller — see the note at the top
 * of `mutating-route-permissions.spec.ts`: entering the entity graph from a controller leaves a decorator module
 * half-initialized.
 */
import 'reflect-metadata';
import '../../core/entities/internal';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA, ROLES_METADATA } from '@gauzy/constants';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { CandidatePersonalQualitiesController } from '../../candidate-personal-qualities/candidate-personal-qualities.controller';
import { CandidateTechnologiesController } from '../../candidate-technologies/candidate-technologies.controller';
import { IssueTypeController } from '../../tasks/issue-type/issue-type.controller';
import { TaskPriorityController } from '../../tasks/priorities/priority.controller';
import { TaskRelatedIssueTypeController } from '../../tasks/related-issue-type/related-issue-type.controller';
import { TaskSizeController } from '../../tasks/sizes/size.controller';
import { TaskStatusController } from '../../tasks/statuses/status.controller';
import { TaskVersionController } from '../../tasks/versions/version.controller';
import { PermissionGuard } from './permission.guard';
import { RoleGuard } from './role.guard';

/**
 * GHSA-v79w-54p2-wmh5 — the retire-and-restore pair of the controllers that have no GraphQL resolver.
 *
 * `CrudController` and `CrudFactory` declare `DELETE :id/soft` and `PUT :id/recover` with no permission
 * metadata, and `PermissionGuard` answers `true` to empty metadata, so on a controller that does not override
 * them any authenticated member of the tenant can retire and restore its rows. The controllers below now
 * override both routes only to attach the grant their resource already uses — the task settings their
 * `ORG_TASK_SETTING` grant, the two candidate profiles the role set every other route of theirs states.
 *
 * `mutating-route-permissions.spec.ts` reads the decorators out of the sources; this suite loads the classes
 * and reads the metadata Nest itself reads, for the controllers no resolver spec loads. (The ones that have a
 * resolver are held to the same metadata by their `*.resolver.spec.ts`, field by field.)
 */
const TASK_SETTINGS = [
	IssueTypeController,
	TaskPriorityController,
	TaskRelatedIssueTypeController,
	TaskSizeController,
	TaskStatusController,
	TaskVersionController
];

const CANDIDATE_PROFILES = [CandidatePersonalQualitiesController, CandidateTechnologiesController];

/** The two routes, by handler name, with the method and the path each must still be served on. */
const PAIR: ReadonlyArray<[string, number, string]> = [
	['softRemove', 3 /* RequestMethod.DELETE */, ':id/soft'],
	['softRecover', 2 /* RequestMethod.PUT */, ':id/recover']
];

function handler(controller: Function, name: string): Function {
	return (controller.prototype as Record<string, Function>)[name];
}

describe('the retire-and-restore pair of the controllers without a resolver', () => {
	it.each(TASK_SETTINGS.map((controller) => [controller.name, controller]))(
		'%s states ORG_TASK_SETTING behind PermissionGuard on both routes, and still serves them',
		(_name, controller) => {
			for (const [name, method, path] of PAIR) {
				const route = handler(controller as Function, name);

				// The override is the controller's own, so the metadata is not the shared base handler's.
				expect(Object.prototype.hasOwnProperty.call((controller as Function).prototype, name)).toBe(true);
				expect(Reflect.getMetadata('method', route)).toBe(method);
				expect(Reflect.getMetadata('path', route)).toBe(path);
				expect(Reflect.getMetadata(GUARDS_METADATA, route)).toEqual([PermissionGuard]);
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, route)).toEqual([PermissionsEnum.ORG_TASK_SETTING]);
			}
		}
	);

	it.each(CANDIDATE_PROFILES.map((controller) => [controller.name, controller]))(
		'%s states the candidate profile role set behind RoleGuard on both routes, as its other routes do',
		(_name, controller) => {
			for (const [name, method, path] of PAIR) {
				const route = handler(controller as Function, name);

				expect(Object.prototype.hasOwnProperty.call((controller as Function).prototype, name)).toBe(true);
				expect(Reflect.getMetadata('method', route)).toBe(method);
				expect(Reflect.getMetadata('path', route)).toBe(path);
				expect(Reflect.getMetadata(GUARDS_METADATA, route)).toEqual([RoleGuard]);
				expect(Reflect.getMetadata(ROLES_METADATA, route)).toEqual([
					RolesEnum.CANDIDATE,
					RolesEnum.SUPER_ADMIN,
					RolesEnum.ADMIN
				]);
				// The control: the sibling route the role set was taken from states the same set.
				expect(Reflect.getMetadata(ROLES_METADATA, handler(controller as Function, 'delete'))).toEqual(
					Reflect.getMetadata(ROLES_METADATA, route)
				);
			}
		}
	);
});
