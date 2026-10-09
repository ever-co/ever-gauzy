jest.mock('../shared/validators/constraints', () => {
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

jest.mock('../role-permission/role-permission.module', () => {
	class RolePermissionModule {}

	return { RolePermissionModule };
});

jest.mock('../shared/guards', () => {
	class TenantPermissionGuard {}
	class PassingGuard {}

	return new Proxy(
		{ __esModule: true, TenantPermissionGuard },
		{
			get: (target, property) => (property in target ? target[property as keyof typeof target] : PassingGuard)
		}
	);
});

jest.mock('../tasks/task.module', () => {
	class TaskModule {}

	return { TaskModule };
});

import { MODULE_METADATA } from '@nestjs/common/constants';
import { TaskMetadataBootstrapModule } from '../tasks/task-metadata-bootstrap';
import { AppModule } from './app.module';

describe('AppModule task metadata wiring', () => {
	it('registers the task metadata bootstrap module exactly once without constraining import order', () => {
		const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];

		expect(imports.filter((module) => module === TaskMetadataBootstrapModule)).toHaveLength(1);
	});
});
