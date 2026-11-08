import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { of } from 'rxjs';
import { ITimeLog, ITimesheet, TimeLogType, TimesheetStatus } from '@gauzy/contracts';
import { TimesheetService } from '@gauzy/ui-core/core';
import { EditTimeLogModalComponent } from '@gauzy/ui-core/shared';
import { ManualTimeModule } from '../manual-time.module';
import { ManualTimeDetailsComponent } from './manual-time-details.component';

const ENTRY = {
	id: 'log-1',
	organizationId: 'org-1',
	tenantId: 'tenant-1',
	employeeId: 'employee-1',
	logType: TimeLogType.MANUAL,
	startedAt: new Date('2026-11-02T07:00:00Z'),
	stoppedAt: new Date('2026-11-02T08:30:00Z'),
	createdAt: new Date('2026-11-02T09:00:00Z'),
	duration: 5400,
	reason: 'Forgot to start the timer',
	isBillable: true
} as ITimeLog;

describe('ManualTimeDetailsComponent', () => {
	let fixture: ComponentFixture<ManualTimeDetailsComponent>;
	let component: ManualTimeDetailsComponent;
	let dialogRef: { close: jest.Mock };
	let dialogService: { open: jest.Mock };
	let getTimeLogs: jest.Mock;

	/** Lets the dialog's read of the employee's day settle. */
	const settle = () => new Promise((resolve) => setTimeout(resolve));

	const render = (timeLog: ITimeLog) => {
		fixture = TestBed.createComponent(ManualTimeDetailsComponent);
		component = fixture.componentInstance;
		component.timeLog = timeLog;
		component.timeZone = 'Etc/UTC';
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	};

	beforeEach(async () => {
		dialogRef = { close: jest.fn() };
		dialogService = { open: jest.fn() };
		getTimeLogs = jest.fn().mockResolvedValue([]);
		await TestBed.configureTestingModule({
			imports: [ManualTimeModule, NgxPermissionsModule.forRoot()],
			providers: [
				{ provide: NbDialogRef, useValue: dialogRef },
				{ provide: NbDialogService, useValue: dialogService },
				{ provide: TimesheetService, useValue: { getTimeLogs } },
				provideRouter([])
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	it('shows an added entry with its reason and no edit in its history', () => {
		const element = render(ENTRY);

		expect(component.isEdited).toBe(false);
		expect(element.textContent).toContain('Forgot to start the timer');
		expect(element.querySelector('.history-item--edited')).toBeNull();
		expect(element.querySelector('.history-item--none')).not.toBeNull();
	});

	it('shows the last edit of an edited entry', () => {
		const element = render({ ...ENTRY, editedAt: new Date('2026-11-03T10:00:00Z') });

		expect(component.isEdited).toBe(true);
		expect(element.querySelector('.action-pill--edited')).not.toBeNull();
		expect(element.querySelector('.history-item--edited')).not.toBeNull();
	});

	it("reads the employee's whole day and charts this entry against it", async () => {
		getTimeLogs.mockResolvedValue([
			ENTRY,
			{
				id: 'tracked-1',
				logType: TimeLogType.TRACKED,
				startedAt: new Date('2026-11-02T09:00:00Z'),
				stoppedAt: new Date('2026-11-02T13:30:00Z'),
				duration: 16200
			} as ITimeLog
		]);
		const element = render(ENTRY);
		await settle();
		fixture.detectChanges();

		expect(getTimeLogs).toHaveBeenCalledWith({
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			employeeIds: ['employee-1'],
			startDate: '2026-11-01 00:00:00',
			endDate: '2026-11-02 23:59:59',
			timeZone: 'Etc/UTC'
		});
		expect(component.day.total).toBe(5400 + 16200);
		expect(component.trackedShare).toBe(75);
		expect(component.currentShare).toBe(25);
		expect(element.querySelectorAll('.timeline-segment')).toHaveLength(2);
		expect(element.querySelector('.timeline-segment--current')).not.toBeNull();
		expect(element.querySelector('.split-bar')).not.toBeNull();
	});

	it('charts the entry alone and says so when the day cannot be read', async () => {
		getTimeLogs.mockRejectedValue(new Error('offline'));
		const element = render(ENTRY);
		await settle();
		fixture.detectChanges();

		expect(component.dayFailed).toBe(true);
		expect(component.dayLoading).toBe(false);
		expect(element.querySelectorAll('.timeline-segment')).toHaveLength(1);
		expect(element.querySelector('.panel-note')).not.toBeNull();
	});

	it('links the project and the task to their own pages, closing the dialog on the way', () => {
		const element = render({
			...ENTRY,
			project: { id: 'project-1', name: 'Cloud Infrastructure' } as ITimeLog['project'],
			task: { id: 'task-1', title: 'Manage role access' } as ITimeLog['task']
		});
		const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.entity-link'));

		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'/pages/organization/projects/view/project-1',
			'/pages/tasks/view/task-1'
		]);

		const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		links[1].click();
		expect(String(navigate.mock.calls[0][0])).toBe('/pages/tasks/view/task-1');
		expect(dialogRef.close).toHaveBeenCalledWith(null);
	});

	it('shows no link for an entry without a project or a task', () => {
		const element = render(ENTRY);

		expect(element.querySelector('a.entity-link')).toBeNull();
	});

	it('closes with nothing when dismissed', () => {
		render(ENTRY);
		component.close();

		expect(dialogRef.close).toHaveBeenCalledWith(null);
	});

	it('closes with the saved entry once it is edited, so the report reloads', () => {
		const saved = { ...ENTRY, reason: 'Corrected' } as ITimeLog;
		dialogService.open.mockReturnValue({ onClose: of(saved) });
		render(ENTRY);

		component.edit();

		expect(dialogService.open).toHaveBeenCalledWith(EditTimeLogModalComponent, { context: { timeLog: ENTRY } });
		expect(dialogRef.close).toHaveBeenCalledWith(saved);
	});

	it('stays open when the edit is cancelled', () => {
		dialogService.open.mockReturnValue({ onClose: of(null) });
		render(ENTRY);

		component.edit();

		expect(dialogRef.close).not.toHaveBeenCalled();
	});

	it('does not edit an entry of an approved timesheet: its hours are final', () => {
		render({ ...ENTRY, timesheet: { status: TimesheetStatus.APPROVED } as ITimesheet } as ITimeLog);

		expect(component.isApproved).toBe(true);
		component.edit();

		expect(dialogService.open).not.toHaveBeenCalled();
	});
});
