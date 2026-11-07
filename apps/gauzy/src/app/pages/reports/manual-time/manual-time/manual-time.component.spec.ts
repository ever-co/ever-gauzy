import { ComponentFixture, TestBed } from '@angular/core/testing';
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
				}
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
		expect(relations).toEqual(['task', 'project', 'employee', 'employee.user']);
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
