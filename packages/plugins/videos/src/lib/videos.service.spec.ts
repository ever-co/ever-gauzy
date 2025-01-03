import { Test, TestingModule } from '@nestjs/testing';
import { VideosService } from './services/videos.service';

describe('VideosService', () => {
	let service: VideosService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [VideosService]
		}).compile();

		service = module.get<VideosService>(VideosService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
