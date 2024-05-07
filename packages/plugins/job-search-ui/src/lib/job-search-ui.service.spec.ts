import { TestBed } from '@angular/core/testing';

import { JobSearchUiService } from './job-search-ui.service';

describe('JobSearchUiService', () => {
	let service: JobSearchUiService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(JobSearchUiService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
