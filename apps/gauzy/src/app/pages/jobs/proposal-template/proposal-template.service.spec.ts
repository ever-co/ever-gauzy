import { TestBed } from '@angular/core/testing';

import { ProposalTemplateService } from './proposal-template.service';

describe('ProposalTemplateService', () => {
	let service: ProposalTemplateService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false }
		});
		service = TestBed.inject(ProposalTemplateService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
