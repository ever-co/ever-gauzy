import { Test, TestingModule } from '@nestjs/testing';
import { ZapierController } from './zapier.controller';

describe('ZapierController', () => {
	let controller: ZapierController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ZapierController]
		}).compile();

		controller = module.get<ZapierController>(ZapierController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
