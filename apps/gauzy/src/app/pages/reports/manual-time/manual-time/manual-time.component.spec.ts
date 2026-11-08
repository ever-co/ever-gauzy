import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { IOrganization, ITimeLog, ITimeLogFilters, ManualTimeLogAction, TimeLogType } from '@gauzy/contracts';
import {
	AuthService,
	DateRangePickerBuilderService,
	DEFAULT_DATE_PICKER_CONFIG,
	TasksService,
	TimesheetService
} from '@gauzy/ui-core/core';
import { ManualTimeComponent } from './manual-time.component';
import { ManualTimeModule } from '../manual-time.module';
import { MANUAL_TIME_REPORT_PAGE_SIZE } from './manual-time-report';
import { NbDialogService } from '@nebular/theme';
import { ManualTimeDetailsComponent } from '../manual-time-details/manual-time-details.component';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' } as IOrganization;

const page = (count: number, offset = 0): ITimeLog[] =>
	Array.from(
		{ length: count },
		(_, i) =>
			({
				id: `log-${offset + i}`,
				employeeId: 'employee-1',
				startedAt: new Date('2026-11-02T09:00:00Z'),
				stoppedAt: new Date('2026-11-02T10:00:00Z'),
				createdAt: new Date('2026-11-02T10:05:00Z'),
				duration: 3600
			} as ITimeLog)
	);

/** Lets the awaited request inside the component settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

/**
 * The request the page read last. Writing a task into the task selector makes it report the value back as a
 * change, which re-runs the request at once, so the index of a particular call is not something to rely on.
 */
const lastRequest = (mock: jest.Mock) => mock.mock.calls[mock.mock.calls.length - 1][0];

describe('ManualTimeComponent', () => {
	let component: ManualTimeComponent;
	let fixture: ComponentFixture<ManualTimeComponent>;
	let getTimeLogs: jest.Mock;

	beforeEach(async () => {
		getTimeLogs = jest.fn().mockResolvedValue([]);
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [ManualTimeModule],
			providers: [
				{ provide: TimesheetService, useValue: { getTimeLogs } },
				// The task filter lists tasks and checks whether one may be added
				{ provide: AuthService, useValue: { hasPermissions: () => of(false) } },
				{
					provide: TasksService,
					useValue: { getAllTasks: () => of({ items: [] }), getAllTasksByEmployee: async () => [] }
				},
				// The Project and Task cells link to their pages
				provideRouter([])
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		// In the app the page's route data sets this before the page renders; the template reads
		// `(datePickerConfig$ | async).isSaveDatePicker`, which is null until something does.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(ManualTimeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	/** Puts the page in the state the header selectors and the filters bar leave it in. */
	const select = (teamIds: string[] = []) => {
		component.organization = ORGANIZATION;
		// The filters bar always emits something; an empty object reads as "not emitted yet"
		component.filters = { timeZone: 'Etc/UTC' };
		component.request = {
			employeeIds: [],
			projectIds: [],
			teamIds,
			startDate: '2026-11-01',
			endDate: '2026-11-07'
		} as ITimeLogFilters;
	};

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('reads the first page of manual entries only', async () => {
		select();
		component.prepareRequest();
		await settle();

		expect(getTimeLogs).toHaveBeenCalledTimes(1);
		const [request, relations] = getTimeLogs.mock.calls[0];
		expect(request).toEqual(
			expect.objectContaining({
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				logType: [TimeLogType.MANUAL],
				take: MANUAL_TIME_REPORT_PAGE_SIZE,
				skip: 1
			})
		);
		expect(request).not.toHaveProperty('isEdited');
		expect(request).not.toHaveProperty('taskIds');
		expect(request).not.toHaveProperty('billableOnly');
		expect(relations).toEqual(['task', 'project', 'organizationContact', 'employee', 'employee.user', 'timesheet']);
	});

	it('sends the action, task and billable filters', async () => {
		select();
		component.actionControl.setValue(ManualTimeLogAction.EDITED, { emitEvent: false });
		component.taskControl.setValue('task-1', { emitEvent: false });
		component.billableOnlyControl.setValue(true, { emitEvent: false });
		component.prepareRequest();
		await settle();

		expect(lastRequest(getTimeLogs)).toEqual(
			expect.objectContaining({ isEdited: true, taskIds: ['task-1'], billableOnly: true })
		);
	});

	it('only sends includeTimeWithoutTeam with a team selected', async () => {
		component.includeTimeWithoutTeamControl.setValue(true, { emitEvent: false });

		select();
		component.prepareRequest();
		await settle();
		expect(getTimeLogs.mock.calls[0][0]).not.toHaveProperty('includeTimeWithoutTeam');

		select(['team-1']);
		component.prepareRequest();
		await settle();
		expect(getTimeLogs.mock.calls[1][0]).toEqual(
			expect.objectContaining({ teamIds: ['team-1'], includeTimeWithoutTeam: true })
		);
	});

	it('does not read the same request twice', async () => {
		select();
		component.prepareRequest();
		await settle();
		component.prepareRequest();
		await settle();

		expect(getTimeLogs).toHaveBeenCalledTimes(1);
	});

	it('clears the task when the selected project changes', async () => {
		select();
		component.prepareRequest();
		await settle();
		component.taskControl.setValue('task-1', { emitEvent: false });

		component.request = { ...component.request, projectIds: ['project-2'] };
		component.prepareRequest();
		await settle();

		expect(component.taskControl.value).toBeNull();
		expect(lastRequest(getTimeLogs)).toEqual(expect.objectContaining({ projectIds: ['project-2'] }));
		expect(lastRequest(getTimeLogs)).not.toHaveProperty('taskIds');
	});

	it('loads the next page on demand and adds it to the report', async () => {
		getTimeLogs
			.mockResolvedValueOnce(page(MANUAL_TIME_REPORT_PAGE_SIZE))
			.mockResolvedValueOnce(page(3, MANUAL_TIME_REPORT_PAGE_SIZE));
		select();
		component.prepareRequest();
		await settle();

		expect(component.hasMore).toBe(true);
		expect(component.summary.entries).toBe(MANUAL_TIME_REPORT_PAGE_SIZE);

		await component.loadMore();

		expect(getTimeLogs.mock.calls[1][0]).toEqual(expect.objectContaining({ skip: 2 }));
		expect(component.timeLogs).toHaveLength(MANUAL_TIME_REPORT_PAGE_SIZE + 3);
		expect(component.summary.entries).toBe(MANUAL_TIME_REPORT_PAGE_SIZE + 3);
		expect(component.hasMore).toBe(false);
	});

	it('opens the details of an entry and reloads once it is saved there', async () => {
		const dialogService = TestBed.inject(NbDialogService);
		const open = jest
			.spyOn(dialogService, 'open')
			.mockReturnValue({ onClose: of({ id: 'log-0' } as ITimeLog) } as ReturnType<NbDialogService['open']>);
		select();
		component.prepareRequest();
		await settle();
		const [entry] = page(1);

		component.openDetails(entry);
		await settle();

		expect(open).toHaveBeenCalledWith(
			ManualTimeDetailsComponent,
			expect.objectContaining({ context: expect.objectContaining({ timeLog: entry }) })
		);
		expect(getTimeLogs).toHaveBeenCalledTimes(2);
	});

	it("links a row's project and task to their pages without opening the row's details", async () => {
		const [entry] = page(1);
		getTimeLogs.mockResolvedValue([
			{
				...entry,
				project: { id: 'project-1', name: 'Cloud Infrastructure' },
				task: { id: 'task-1', title: 'Manage role access' }
			}
		]);
		select();
		component.prepareRequest();
		await settle();
		fixture.detectChanges();
		const openDetails = jest.spyOn(component, 'openDetails').mockImplementation(() => undefined);
		const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.cell-link'));

		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'/pages/organization/projects/view/project-1',
			'/pages/tasks/view/task-1'
		]);

		links[1].click();
		expect(navigate).toHaveBeenCalled();
		expect(String(navigate.mock.calls[0][0])).toBe('/pages/tasks/view/task-1');
		expect(openDetails).not.toHaveBeenCalled();
	});

	it('works out the overview figures from the loaded entries', () => {
		component.summary = { duration: 9000, entries: 4, added: 3, edited: 1, employees: 2 };

		expect(component.averagePerEntry).toBe(2250);
		expect(component.averagePerEmployee).toBe(4500);
		expect(component.shareOf(component.summary.added)).toBe(75);
		expect(component.shareOf(component.summary.edited)).toBe(25);
	});

	it('shows zeroes, not NaN, in the overview of an empty report', () => {
		expect(component.averagePerEntry).toBe(0);
		expect(component.averagePerEmployee).toBe(0);
		expect(component.shareOf(0)).toBe(0);
	});

	it('drops the answer to a request that a newer one replaced', async () => {
		let answerFirst: (logs: ITimeLog[]) => void;
		getTimeLogs
			.mockReturnValueOnce(new Promise<ITimeLog[]>((resolve) => (answerFirst = resolve)))
			.mockResolvedValueOnce(page(1));
		select();
		component.prepareRequest();

		component.billableOnlyControl.setValue(true, { emitEvent: false });
		component.prepareRequest();
		await settle();

		answerFirst(page(5));
		await settle();

		expect(component.timeLogs).toHaveLength(1);
		expect(component.loading).toBe(false);
	});
});
