import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';
import { MikroOrmEmployeeProposalTemplateRepository } from './repository/mikro-orm-employee-proposal-template.repository';
import { TypeOrmEmployeeProposalTemplateRepository } from './repository/type-orm-employee-proposal-template.repository';
describe('EmployeeProposalTemplateService', () => {
	let service: EmployeeProposalTemplateService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EmployeeProposalTemplateService,
				// The repositories the constructor injects; being constructible is all this spec checks.
				{ provide: TypeOrmEmployeeProposalTemplateRepository, useValue: {} },
				{ provide: MikroOrmEmployeeProposalTemplateRepository, useValue: {} }
			]
		}).compile();
		service = module.get<EmployeeProposalTemplateService>(EmployeeProposalTemplateService);
	});
	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
