import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { TimesheetViewComponent } from './view.component';
import { ViewModule } from '../view.module';
describe('TimesheetViewComponent', () => {
	let component: TimesheetViewComponent;
	let fixture: ComponentFixture<TimesheetViewComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. (This stub imported `ViewComponent`; the file exports
			// `TimesheetViewComponent`, so it declared `undefined`.)
			imports: [ViewModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(TimesheetViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});

/**
 * Approve / Deny. The route reuses this component when it moves to another timesheet, so an answer can arrive
 * after the page shows a different timesheet than the one the request was about.
 */
describe('TimesheetViewComponent.updateStatus', () => {
	const sheet = (id: string, status = TimesheetStatus.PENDING) =>
		({ id, organizationId: 'org-1', status }) as ITimesheet;

	/** The page, with the timesheet `current` open and a save that answers when the test says. */
	const page = (current: ITimesheet) => {
		let answer: (rows: ITimesheet[]) => void = () => undefined;
		const view = Object.create(TimesheetViewComponent.prototype) as TimesheetViewComponent;
		Object.assign(view, {
			timesheet: current,
			updatingStatus: false,
			store: { user: { tenantId: 'tenant-1' } },
			toastrService: { success: jest.fn(), danger: jest.fn() },
			timesheetService: {
				updateStatus: jest.fn(() => new Promise<ITimesheet[]>((resolve) => (answer = resolve)))
			}
		});
		return { view, answer: (rows: ITimesheet[]) => answer(rows) };
	};

	it('shows the new status of the timesheet it saved', async () => {
		const { view, answer } = page(sheet('A'));

		const saving = view.updateStatus(TimesheetStatus.APPROVED);
		answer([sheet('A', TimesheetStatus.APPROVED)]);
		await saving;

		expect(view.timesheet).toEqual(sheet('A', TimesheetStatus.APPROVED));
		expect(view.updatingStatus).toBe(false);
		expect((view as any).toastrService.success).toHaveBeenCalledWith('TIMESHEET.APPROVE_SUCCESS');
	});

	it('leaves alone a timesheet opened while the approval of another one was saved', async () => {
		const { view, answer } = page(sheet('A'));
		const opened = sheet('B');

		const saving = view.updateStatus(TimesheetStatus.APPROVED);
		view.timesheet = opened;
		answer([sheet('A', TimesheetStatus.APPROVED)]);
		await saving;

		// B keeps its own id and status: the review actions still act on B
		expect(view.timesheet).toBe(opened);
		expect(view.timesheet).toEqual(sheet('B'));
		expect(view.updatingStatus).toBe(false);
		// Nor does B get a notice that would read as its own approval
		expect((view as any).toastrService.success).not.toHaveBeenCalled();
	});
});
