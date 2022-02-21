import { SafePipe } from './safe.pipe';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';

describe('SafePipe', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [BrowserModule],
			providers: [DomSanitizer]
		});
	});

	it('should create an instance', () => {
		const sanitizer: DomSanitizer = TestBed.inject(DomSanitizer);
		const pipe = new SafePipe(sanitizer);
		expect(pipe).toBeTruthy();
	});
});
