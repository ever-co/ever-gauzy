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

jest.mock('../../role-permission/role-permission.module', () => {
	class RolePermissionModule {}

	return { RolePermissionModule };
});

jest.mock('../../shared/guards', () => {
	class TenantPermissionGuard {}
	class PassingGuard {}

	return new Proxy(
		{ __esModule: true, TenantPermissionGuard },
		{
			get: (target, property) => (property in target ? target[property as keyof typeof target] : PassingGuard)
		}
	);
});

jest.mock('../task.module', () => {
	class TaskModule {}

	return { TaskModule };
});

import { Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from '../../app/app.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TagModule } from '../../tags/tag.module';
import { TagService } from '../../tags/tag.service';
import { MikroOrmTagRepository } from '../../tags/repository/mikro-orm-tag.repository';
import { TypeOrmTagRepository } from '../../tags/repository/type-orm-tag.repository';
import { CommandHandlers as IssueTypeCommandHandlers } from '../issue-type/commands/handlers';
import { IssueTypeController } from '../issue-type/issue-type.controller';
import { IssueTypeModule } from '../issue-type/issue-type.module';
import { IssueTypeService } from '../issue-type/issue-type.service';
import { MikroOrmIssueTypeRepository } from '../issue-type/repository/mikro-orm-issue-type.repository';
import { TypeOrmIssueTypeRepository } from '../issue-type/repository/type-orm-issue-type.repository';
import { TaskLinkedIssueModule } from '../linked-issue/task-linked-issue.module';
import { CommandHandlers as TaskPriorityCommandHandlers } from '../priorities/commands/handlers';
import { TaskPriorityController } from '../priorities/priority.controller';
import { TaskPriorityModule } from '../priorities/priority.module';
import { TaskPriorityService } from '../priorities/priority.service';
import { MikroOrmTaskPriorityRepository } from '../priorities/repository/mikro-orm-task-priority.repository';
import { TypeOrmTaskPriorityRepository } from '../priorities/repository/type-orm-task-priority.repository';
import { CommandHandlers as RelatedIssueTypeCommandHandlers } from '../related-issue-type/commands/handlers';
import { QueryHandlers as RelatedIssueTypeQueryHandlers } from '../related-issue-type/queries/handlers';
import { TaskRelatedIssueTypeController } from '../related-issue-type/related-issue-type.controller';
import { TaskRelatedIssueTypeModule } from '../related-issue-type/related-issue-type.module';
import { TaskRelatedIssueTypeService } from '../related-issue-type/related-issue-type.service';
import { MikroOrmTaskRelatedIssueTypeRepository } from '../related-issue-type/repository/mikro-orm-related-issue-type.repository';
import { TypeOrmTaskRelatedIssueTypeRepository } from '../related-issue-type/repository/type-orm-related-issue-type.repository';
import { CommandHandlers as TaskSizeCommandHandlers } from '../sizes/commands/handlers';
import { TaskSizeController } from '../sizes/size.controller';
import { TaskSizeModule } from '../sizes/size.module';
import { TaskSizeService } from '../sizes/size.service';
import { MikroOrmTaskSizeRepository } from '../sizes/repository/mikro-orm-task-size.repository';
import { TypeOrmTaskSizeRepository } from '../sizes/repository/type-orm-task-size.repository';
import { CommandHandlers as TaskStatusCommandHandlers } from '../statuses/commands/handlers';
import { QueryHandlers as TaskStatusQueryHandlers } from '../statuses/queries/handlers';
import { MikroOrmTaskStatusRepository } from '../statuses/repository/mikro-orm-task-status.repository';
import { TypeOrmTaskStatusRepository } from '../statuses/repository/type-orm-task-status.repository';
import { TaskStatusController } from '../statuses/status.controller';
import { TaskStatusModule } from '../statuses/status.module';
import { TaskStatusService } from '../statuses/status.service';
import { TaskModule } from '../task.module';
import { TaskVersionModule } from '../versions/version.module';
import { TaskVersionService } from '../versions/version.service';
import { TaskMetadataBootstrapQueryDTO } from './dto';
import * as TaskMetadataBootstrapExports from './index';
import { TaskMetadataBootstrapController } from './task-metadata-bootstrap.controller';
import { TaskMetadataBootstrapModule } from './task-metadata-bootstrap.module';
import { TaskMetadataBootstrapService } from './task-metadata-bootstrap.service';

type ModuleMetadataCase = {
	name: string;
	module: Type<unknown>;
	service: Type<unknown>;
	imports: unknown[];
	controllers: unknown[];
	providers: unknown[];
};

const moduleMetadataCases: ModuleMetadataCase[] = [
	{
		name: 'TaskStatusModule',
		module: TaskStatusModule,
		service: TaskStatusService,
		imports: [TypeOrmModule, MikroOrmModule, RolePermissionModule, CqrsModule],
		controllers: [TaskStatusController],
		providers: [
			TaskStatusService,
			TypeOrmTaskStatusRepository,
			MikroOrmTaskStatusRepository,
			...TaskStatusQueryHandlers,
			...TaskStatusCommandHandlers
		]
	},
	{
		name: 'TaskPriorityModule',
		module: TaskPriorityModule,
		service: TaskPriorityService,
		imports: [TypeOrmModule, MikroOrmModule, RolePermissionModule, CqrsModule],
		controllers: [TaskPriorityController],
		providers: [
			TaskPriorityService,
			TypeOrmTaskPriorityRepository,
			MikroOrmTaskPriorityRepository,
			...TaskPriorityCommandHandlers
		]
	},
	{
		name: 'TaskSizeModule',
		module: TaskSizeModule,
		service: TaskSizeService,
		imports: [TypeOrmModule, MikroOrmModule, CqrsModule, RolePermissionModule],
		controllers: [TaskSizeController],
		providers: [TaskSizeService, TypeOrmTaskSizeRepository, MikroOrmTaskSizeRepository, ...TaskSizeCommandHandlers]
	},
	{
		name: 'IssueTypeModule',
		module: IssueTypeModule,
		service: IssueTypeService,
		imports: [TypeOrmModule, MikroOrmModule, RolePermissionModule, CqrsModule],
		controllers: [IssueTypeController],
		providers: [
			IssueTypeService,
			TypeOrmIssueTypeRepository,
			MikroOrmIssueTypeRepository,
			...IssueTypeCommandHandlers
		]
	},
	{
		name: 'TaskRelatedIssueTypeModule',
		module: TaskRelatedIssueTypeModule,
		service: TaskRelatedIssueTypeService,
		imports: [TypeOrmModule, MikroOrmModule, RolePermissionModule, CqrsModule],
		controllers: [TaskRelatedIssueTypeController],
		providers: [
			TaskRelatedIssueTypeService,
			TypeOrmTaskRelatedIssueTypeRepository,
			MikroOrmTaskRelatedIssueTypeRepository,
			...RelatedIssueTypeQueryHandlers,
			...RelatedIssueTypeCommandHandlers
		]
	}
];

function getMetadata<T>(key: string, target: Type<unknown>): T {
	return Reflect.getMetadata(key, target) as T;
}

function getImportedModule(value: unknown): unknown {
	if (value && typeof value === 'object' && 'module' in value) {
		return (value as { module: unknown }).module;
	}

	return value;
}

function expectExactExports(module: Type<unknown>, expected: Type<unknown>[]): void {
	const exports = getMetadata<unknown[]>(MODULE_METADATA.EXPORTS, module);

	expect(exports).toEqual(expected);
	expect(new Set(exports).size).toBe(exports.length);
}

describe('task metadata module exports', () => {
	it.each(moduleMetadataCases)('$name exports only its existing read service', ({ module, service }) => {
		expectExactExports(module, [service]);

		const providers = getMetadata<unknown[]>(MODULE_METADATA.PROVIDERS, module);
		expect(providers).toContain(service);
		expect(providers.filter((provider) => provider === service)).toHaveLength(1);
	});

	it.each(moduleMetadataCases)(
		'$name preserves its existing imports, controllers, and providers',
		({ module, imports, controllers, providers }) => {
			const actualImports = getMetadata<unknown[]>(MODULE_METADATA.IMPORTS, module);

			expect(actualImports.map(getImportedModule)).toEqual(imports);
			expect(getMetadata(MODULE_METADATA.CONTROLLERS, module)).toEqual(controllers);
			expect(getMetadata(MODULE_METADATA.PROVIDERS, module)).toEqual(providers);
		}
	);

	it('preserves the existing TaskVersionModule service export', () => {
		expectExactExports(TaskVersionModule, [TaskVersionService]);
	});

	it('preserves all three existing TagModule exports in order', () => {
		expectExactExports(TagModule, [TagService, TypeOrmTagRepository, MikroOrmTagRepository]);
	});

	it('declares the standalone bootstrap module with only the exact dependencies and components', () => {
		const imports = getMetadata<unknown[]>(MODULE_METADATA.IMPORTS, TaskMetadataBootstrapModule);

		expect(imports).toEqual([
			TaskStatusModule,
			TaskPriorityModule,
			TaskSizeModule,
			TagModule,
			TaskVersionModule,
			IssueTypeModule,
			TaskRelatedIssueTypeModule,
			RolePermissionModule
		]);
		expect(imports).not.toContain(TaskModule);
		expect(getMetadata(MODULE_METADATA.PROVIDERS, TaskMetadataBootstrapModule)).toEqual([
			TaskMetadataBootstrapService
		]);
		expect(getMetadata(MODULE_METADATA.CONTROLLERS, TaskMetadataBootstrapModule)).toEqual([
			TaskMetadataBootstrapController
		]);
	});

	it('exports only the DTO, module, and service from the local barrel', () => {
		expect(Object.keys(TaskMetadataBootstrapExports).sort()).toEqual(
			[
				TaskMetadataBootstrapQueryDTO.name,
				TaskMetadataBootstrapModule.name,
				TaskMetadataBootstrapService.name
			].sort()
		);
		expect(TaskMetadataBootstrapExports).not.toHaveProperty(TaskMetadataBootstrapController.name);
	});

	it('registers the bootstrap module once immediately after IssueTypeModule in AppModule', () => {
		const imports = getMetadata<unknown[]>(MODULE_METADATA.IMPORTS, AppModule);
		const issueTypeIndex = imports.indexOf(IssueTypeModule);

		expect(issueTypeIndex).toBeGreaterThanOrEqual(0);
		expect(imports.filter((module) => module === TaskMetadataBootstrapModule)).toHaveLength(1);
		expect(imports.slice(issueTypeIndex, issueTypeIndex + 3)).toEqual([
			IssueTypeModule,
			TaskMetadataBootstrapModule,
			TaskLinkedIssueModule
		]);
	});
});
