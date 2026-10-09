import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeTrackerComponent } from './time-tracker.component';
import { TimeTrackerModule } from '../time-tracker.module';

/**
 * TimeTrackerService runs its clock in a Web Worker when `Worker` exists and skips it otherwise, but
 * its `ngOnDestroy` terminates the worker unconditionally. jsdom has no `Worker`, so TestBed teardown
 * threw. Browsers always have one; give the test environment the same, as an inert stand-in.
 */
class WorkerStub {
	onmessage: ((event: MessageEvent) => void) | null = null;
	postMessage(): void {}
	terminate(): void {}
}

describe('TimeTrackerComponent', () => {
	let component: TimeTrackerComponent;
	let fixture: ComponentFixture<TimeTrackerComponent>;
	const originalWorker = (globalThis as any).Worker;
	beforeAll(() => {
		(globalThis as any).Worker = WorkerStub;
	});
	afterAll(() => {
		(globalThis as any).Worker = originalWorker;
	});
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule; `forRoot()` also provides TimeTrackerService, as the app does.
			imports: [TimeTrackerModule.forRoot()],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(TimeTrackerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
