import { TestBed } from '@angular/core/testing';
import { LastPayloadViewerComponent } from './last-payload-viewer.component';

describe('LastPayloadViewerComponent', () => {
	function render(inputs: Partial<LastPayloadViewerComponent>) {
		TestBed.configureTestingModule({ imports: [LastPayloadViewerComponent] });
		const fixture = TestBed.createComponent(LastPayloadViewerComponent);
		Object.assign(fixture.componentInstance, inputs);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	it('pretty-prints the report and shows its size, date and HTTP status', () => {
		const el = render({ payload: '{"a":{"b":1}}', bytes: 13, sentAt: '2026-10-02T10:00:00.000Z', httpStatus: 202 });
		expect(el.querySelector('[data-test="payload"]')?.textContent).toBe('{\n  "a": {\n    "b": 1\n  }\n}');
		expect(el.querySelector('[data-test="bytes"]')?.textContent).toContain('13');
		expect(el.querySelector('[data-test="http-status"]')?.textContent).toContain('202');
		expect(el.querySelector('[data-test="sent-at"]')).not.toBeNull();
	});

	it('shows the exact stored bytes, unchanged, on request', () => {
		TestBed.configureTestingModule({ imports: [LastPayloadViewerComponent] });
		const fixture = TestBed.createComponent(LastPayloadViewerComponent);
		Object.assign(fixture.componentInstance, { payload: '{"a":{"b":1}}', bytes: 13 });
		fixture.detectChanges();
		const el = fixture.nativeElement as HTMLElement;
		(el.querySelector('[data-test="raw-toggle"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(el.querySelector('[data-test="payload"]')?.textContent).toBe('{"a":{"b":1}}');
		(el.querySelector('[data-test="raw-toggle"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(el.querySelector('[data-test="payload"]')?.textContent).toContain('"b": 1');
	});

	it('shows text that is not JSON as it is', () => {
		const el = render({ payload: 'not json', bytes: 8 });
		expect(el.querySelector('[data-test="payload"]')?.textContent).toBe('not json');
		expect(el.querySelector('[data-test="sent-at"]')).toBeNull();
	});
});
