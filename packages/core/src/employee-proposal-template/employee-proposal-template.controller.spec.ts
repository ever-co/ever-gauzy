import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeProposalTemplateController } from './employee-proposal-template.controller';

describe('EmployeeProposalTemplateController', () => {
	let controller: EmployeeProposalTemplateController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [EmployeeProposalTemplateController]
		}).compile();

		controller = module.get<EmployeeProposalTemplateController>(
			EmployeeProposalTemplateController
		);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
