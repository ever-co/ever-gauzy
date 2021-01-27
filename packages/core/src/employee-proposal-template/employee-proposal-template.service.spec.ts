import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';

describe('EmployeeProposalTemplateService', () => {
	let service: EmployeeProposalTemplateService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [EmployeeProposalTemplateService]
		}).compile();

		service = module.get<EmployeeProposalTemplateService>(
			EmployeeProposalTemplateService
		);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
