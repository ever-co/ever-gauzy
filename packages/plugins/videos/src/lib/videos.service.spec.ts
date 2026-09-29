import { Test, TestingModule } from '@nestjs/testing';
import { MikroOrmVideoRepository } from './repositories/mikro-orm-video.repository';
import { TypeOrmVideoRepository } from './repositories/type-orm-video.repository';
import { VideosService } from './services/videos.service';
describe('VideosService', () => {
	let service: VideosService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VideosService,
				// The repositories the constructor injects; being constructible is all this spec checks.
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
