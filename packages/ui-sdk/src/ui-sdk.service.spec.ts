import { TestBed } from '@angular/core/testing';

import { UiSdkService } from './ui-sdk.service';

describe('UiSdkService', () => {
	let service: UiSdkService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(UiSdkService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
