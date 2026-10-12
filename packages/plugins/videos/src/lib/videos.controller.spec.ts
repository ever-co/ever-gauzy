import { EmployeeTrackedDataGuard, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { MikroOrmVideoRepository } from './repositories/mikro-orm-video.repository';
import { TypeOrmVideoRepository } from './repositories/type-orm-video.repository';
import { VideosService } from './services/videos.service';
import { VideosController } from './videos.controller';
describe('VideosController', () => {
	let controller: VideosController;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [VideosController],
			providers: [
				VideosService,
				// The controller dispatches through CQRS; these are the buses its constructor injects.
				{ provide: CommandBus, useValue: {} },
				{ provide: QueryBus, useValue: {} },
				// `VideosService` is not a dependency of the controller, which dispatches through CQRS. It is
				// kept because the original spec declared it; the module still instantiates it, so its
				// repositories must resolve.
				{ provide: TypeOrmVideoRepository, useValue: {} },
				{ provide: MikroOrmVideoRepository, useValue: {} }
			]
		})
			// `@UseGuards` guards are instantiated by the module that owns the controller, so the real ones
			// would drag in the cache manager, the role-permission service and a DataSource. They are not
			// constructor dependencies of the controller, so they are out of scope for this check.
			.overrideGuard(TenantPermissionGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(PermissionGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(EmployeeTrackedDataGuard)
			.useValue({ canActivate: () => true })
			.compile();
		controller = module.get<VideosController>(VideosController);
	});
	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
