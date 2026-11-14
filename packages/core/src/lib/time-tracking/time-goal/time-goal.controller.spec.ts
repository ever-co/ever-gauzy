import 'reflect-metadata';
import '../../core/entities/internal';

import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { EmployeeTrackedDataGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TimeGoalController } from './time-goal.controller';

const handlers = Object.getOwnPropertyNames(TimeGoalController.prototype).filter((name) => name !== 'constructor');
const route = (name: string) => {
	const handler = (TimeGoalController.prototype as unknown as Record<string, unknown>)[name];
	return {
		path: Reflect.getMetadata(PATH_METADATA, handler) as string,
		method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
		guards: (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[]
	};
};

describe('TimeGoalController', () => {
	it('admits the callers the time statistics admit, behind the tenant and permission guards', () => {
		expect(Reflect.getMetadata(PATH_METADATA, TimeGoalController)).toBe('/time-goals');
		expect(Reflect.getMetadata(GUARDS_METADATA, TimeGoalController)).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeGoalController)).toEqual([
			PermissionsEnum.ADMIN_DASHBOARD_VIEW,
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
	});

	it('keeps tracked time behind the tracked-data setting on the progress read', () => {
		expect(route('getProgress')).toEqual({
			path: '/progress',
			method: RequestMethod.GET,
			guards: [EmployeeTrackedDataGuard]
		});
	});

	it('declares the progress read before the read by id, so "progress" is never taken for an id', () => {
		expect(handlers.indexOf('getProgress')).toBeLessThan(handlers.indexOf('findById'));
		expect(route('findById').path).toBe('/:id');
	});

	it('exposes the create, change, archive, restore and delete routes', () => {
		expect(
			['create', 'update', 'archive', 'restore', 'delete'].map((name) => {
				const { path, method } = route(name);
				return `${RequestMethod[method]} ${path}`;
			})
		).toEqual(['POST /', 'PUT /:id', 'PUT /:id/archive', 'PUT /:id/restore', 'DELETE /:id']);
	});
});
