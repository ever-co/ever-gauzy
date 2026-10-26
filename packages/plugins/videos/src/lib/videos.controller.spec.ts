import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeTrackedDataGuard, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { VideosController } from './videos.controller';

/**
 * The controller is a CQRS one: it takes the command bus and the query bus, not the service. The
 * scaffold provided the service instead, so Nest could resolve neither bus and the suite failed to
 * load rather than failing an assertion. The two buses are doubled — what this suite asserts is that
 * the route class is constructible from what it declares.
 *
 * The two guards are overridden rather than provided: `@UseGuards(SomeGuard)` makes Nest build the
 * guard from this module, and one of these takes a cache manager, a reflector and the role-permission
 * service — an application's worth of collaborators for a suite that asserts a class exists. Nothing
 * here calls a route, so the answer the guard would give is not under test.
 */
describe('VideosController', () => {
	let controller: VideosController;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [VideosController],
			providers: [
				{ provide: CommandBus, useValue: { execute: jest.fn() } },
				{ provide: QueryBus, useValue: { execute: jest.fn() } }
			]
		})
			.overrideGuard(TenantPermissionGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(PermissionGuard)
			.useValue({ canActivate: () => true })
			// The third guard of the chain takes the data source, which is the whole database connection.
			.overrideGuard(EmployeeTrackedDataGuard)
			.useValue({ canActivate: () => true })
			.compile();
		controller = module.get<VideosController>(VideosController);
	});
	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
