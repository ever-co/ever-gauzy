jest.mock('../../shared/validators/constraints', () => {
	const { ValidatorConstraint } = jest.requireActual('class-validator') as typeof import('class-validator');

	class PassingConstraint {
		validate(): boolean {
			return true;
		}
	}

	ValidatorConstraint({ name: 'PassingConstraint', async: false })(PassingConstraint);

	return new Proxy(
		{ __esModule: true },
		{
			get: (target, property) =>
				property in target ? target[property as keyof typeof target] : PassingConstraint
		}
	);
});

jest.mock('../../shared/guards', () => ({ TenantPermissionGuard: class TenantPermissionGuard {} }));
jest.mock('./task-metadata-bootstrap.service', () => ({
	TaskMetadataBootstrapService: class TaskMetadataBootstrapService {}
}));

import 'reflect-metadata';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	PARAMTYPES_METADATA,
	PATH_METADATA,
	PIPES_METADATA,
	ROUTE_ARGS_METADATA
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ITaskMetadataBootstrapResponse } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { TaskMetadataBootstrapQueryDTO } from './dto';
import { TaskMetadataBootstrapController } from './task-metadata-bootstrap.controller';
import { TaskMetadataBootstrapService } from './task-metadata-bootstrap.service';

type TaskMetadataValidationPipe = ValidationPipe & {
	isTransformEnabled: boolean;
	validatorOptions: { whitelist?: boolean };
};

const API_TAGS_METADATA = 'swagger/apiUseTags';

const query = {
	organizationId: '18b92310-bb29-4ae0-b78a-a1e6493b688c',
	organizationTeamId: '94ac71ab-4505-4ead-a357-a12c03d88973',
	projectId: '4bfb00a0-5ec3-4736-bc6d-0d5bb83e114c',
	include: ['taskStatuses', 'taskLabels']
} as TaskMetadataBootstrapQueryDTO;

const response: ITaskMetadataBootstrapResponse = {
	taskStatuses: { items: [], total: 3 },
	taskLabels: { items: [], total: 5 }
};

function createController(bootstrap: TaskMetadataBootstrapService['bootstrap']): TaskMetadataBootstrapController {
	return new TaskMetadataBootstrapController({ bootstrap } as TaskMetadataBootstrapService);
}

describe('TaskMetadataBootstrapController', () => {
	it('registers the exact guarded GET query endpoint and validation boundary', () => {
		const handler = TaskMetadataBootstrapController.prototype.bootstrap;

		expect(Reflect.getMetadata(API_TAGS_METADATA, TaskMetadataBootstrapController)).toEqual(['Task Metadata']);
		expect(Reflect.getMetadata(PATH_METADATA, TaskMetadataBootstrapController)).toBe('/task-metadata');
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/bootstrap');
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
		expect(Reflect.getMetadata(GUARDS_METADATA, TaskMetadataBootstrapController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskMetadataBootstrapController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toBeUndefined();

		expect(
			Reflect.getMetadata(PARAMTYPES_METADATA, TaskMetadataBootstrapController.prototype, 'bootstrap')
		).toEqual([TaskMetadataBootstrapQueryDTO]);
		expect(Reflect.getMetadata(ROUTE_ARGS_METADATA, TaskMetadataBootstrapController, 'bootstrap')).toEqual({
			[`${RouteParamtypes.QUERY}:0`]: { index: 0, data: undefined, pipes: [] }
		});

		const pipes = Reflect.getMetadata(PIPES_METADATA, handler) as TaskMetadataValidationPipe[];
		expect(pipes).toHaveLength(1);
		expect(pipes[0]).toBeInstanceOf(ValidationPipe);
		expect(pipes[0].isTransformEnabled).toBe(true);
		expect(pipes[0].validatorOptions.whitelist).toBe(true);
	});

	it('returns the exact service promise and result for the exact transformed DTO object', async () => {
		const servicePromise = Promise.resolve(response);
		const bootstrap = jest.fn(() => servicePromise);
		const controller = createController(bootstrap);

		const result = controller.bootstrap(query);

		expect(result).toBe(servicePromise);
		expect(bootstrap).toHaveBeenCalledTimes(1);
		expect(bootstrap).toHaveBeenCalledWith(query);
		await expect(result).resolves.toBe(response);
	});

	it('preserves the original service rejection identity', async () => {
		const error = new Error('task metadata bootstrap failed');
		const servicePromise = Promise.reject(error);
		const controller = createController(jest.fn(() => servicePromise));

		const result = controller.bootstrap(query);

		expect(result).toBe(servicePromise);
		await expect(result).rejects.toBe(error);
	});
});
