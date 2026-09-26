import { Test, TestingModule } from '@nestjs/testing';
import { VideosService } from './services/videos.service';
import { MikroOrmVideoRepository } from './repositories/mikro-orm-video.repository';
import { TypeOrmVideoRepository } from './repositories/type-orm-video.repository';

/**
 * The scaffold asked Nest to build the service with no providers at all, which cannot work for a
 * dual-ORM service: it takes a TypeORM repository and a MikroORM one, and Nest answers "can't resolve
 * dependencies" instead of a defined service — the suite failed to load rather than failing an
 * assertion. The pair is doubled here, because nothing in this suite reads or writes: what it asserts
 * is that the class is constructible from the collaborators it declares.
 */
describe('VideosService', () => {
	let service: VideosService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VideosService,
				{ provide: TypeOrmVideoRepository, useValue: {} },
				{ provide: MikroOrmVideoRepository, useValue: {} }
			]
		}).compile();
		service = module.get<VideosService>(VideosService);
	});
	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
