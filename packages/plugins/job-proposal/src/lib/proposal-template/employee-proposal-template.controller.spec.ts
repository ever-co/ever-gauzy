import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeProposalTemplateController } from './employee-proposal-template.controller';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';
describe('EmployeeProposalTemplateController', () => {
	let controller: EmployeeProposalTemplateController;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [EmployeeProposalTemplateController],
			// The service the controller's constructor injects. Its own construction is covered by
			// `employee-proposal-template.service.spec.ts`; here it only has to resolve.
			providers: [{ provide: EmployeeProposalTemplateService, useValue: {} }]
		})
			// `@UseGuards` guards are instantiated by the module that owns the controller, so the real ones
			// would drag in the cache manager and the role-permission service. They are not constructor
			// dependencies of the controller, so they are out of scope for this check.
			.overrideGuard(TenantPermissionGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(PermissionGuard)
			.useValue({ canActivate: () => true })
			.compile();
		controller = module.get<EmployeeProposalTemplateController>(EmployeeProposalTemplateController);
	});
	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
