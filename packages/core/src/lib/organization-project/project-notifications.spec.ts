import { BaseEntityEnum, EmployeeNotificationTypeEnum, ProjectStatusEnum } from '@gauzy/contracts';
import {
	IProjectChange,
	projectArchiveChangeOf,
	projectChangeMessageOf,
	projectChangesOf,
	projectMemberAddedEvents
} from './project-notifications';

describe('project notifications', () => {
	describe('projectMemberAddedEvents', () => {
		const project = { id: 'project-1', name: 'Website', organizationId: 'org-1', tenantId: 'tenant-1' };

		it('tells each added employee once, as an assignment about the project, named as a project', () => {
			const events = projectMemberAddedEvents(project, ['employee-1', 'employee-2', 'employee-1'], {
				employeeId: 'employee-admin',
				name: 'Ada Lovelace'
			});

			expect(events.map(({ input }) => input)).toEqual([
				{
					entity: BaseEntityEnum.OrganizationProject,
					entityId: 'project-1',
					type: EmployeeNotificationTypeEnum.ASSIGNMENT,
					title: 'Ada Lovelace Assigned you to the Project "Website"',
					receiverEmployeeId: 'employee-1',
					sentByEmployeeId: 'employee-admin',
					organizationId: 'org-1',
					tenantId: 'tenant-1'
				},
				expect.objectContaining({ receiverEmployeeId: 'employee-2' })
			]);
		});

		it('does not tell the employee who added themselves (an employee who creates a project manages it)', () => {
			const events = projectMemberAddedEvents(project, ['employee-creator', 'employee-1'], {
				employeeId: 'employee-creator',
				name: 'Grace Hopper'
			});

			expect(events.map(({ input }) => input.receiverEmployeeId)).toEqual(['employee-1']);
		});

		it('names no sender when the one who added them has no employee (a super admin)', () => {
			const [event] = projectMemberAddedEvents(project, ['employee-1'], { employeeId: null, name: 'Admin' });

			expect(event.input).not.toHaveProperty('sentByEmployeeId');
			expect(event.input.title).toBe('Admin Assigned you to the Project "Website"');
		});

		it('shortens a long project name, and a long actor name, so the title fits its column', () => {
			const [event] = projectMemberAddedEvents({ ...project, name: 'p'.repeat(255) }, ['employee-1'], {
				employeeId: 'employee-admin',
				name: 'a'.repeat(255)
			});

			expect(event.input.title.length).toBeLessThanOrEqual(255);
			expect(event.input.title).toMatch(/^a+… Assigned you to the Project "p+…"$/);
		});

		it('tells nobody when nobody was added', () => {
			expect(projectMemberAddedEvents(project, [], { employeeId: 'employee-admin', name: 'Ada' })).toEqual([]);
		});
	});

	describe('projectChangesOf', () => {
		const before = {
			status: ProjectStatusEnum.IN_PROGRESS,
			startDate: new Date('2026-11-01T00:00:00.000Z'),
			endDate: null as Date | null
		};

		it('names each followed field the update changed, by day for a date', () => {
			expect(
				projectChangesOf(before, {
					status: ProjectStatusEnum.COMPLETED,
					startDate: '2026-11-01T00:00:00.000Z',
					endDate: '2026-12-15T00:00:00.000Z',
					name: 'Renamed'
				})
			).toEqual([
				{ field: 'status', from: 'in progress', to: 'completed' },
				{ field: 'endDate', from: null, to: '2026-12-15' }
			]);
		});

		it('names nothing for an update that leaves the followed fields out, or states them as they were', () => {
			expect(projectChangesOf(before, { name: 'Renamed', description: 'More' })).toEqual([]);
			expect(
				projectChangesOf(before, { status: ProjectStatusEnum.IN_PROGRESS, startDate: before.startDate })
			).toEqual([]);
		});

		it('names a date taken away', () => {
			expect(projectChangesOf(before, { startDate: null })).toEqual([
				{ field: 'startDate', from: '2026-11-01', to: null }
			]);
		});
	});

	describe('projectArchiveChangeOf and projectChangeMessageOf', () => {
		it('says the project was archived, or restored, and nothing when it stays as it was', () => {
			expect(projectChangeMessageOf([projectArchiveChangeOf(false, true) as IProjectChange])).toBe(
				'The project was archived.'
			);
			expect(projectChangeMessageOf([projectArchiveChangeOf(true, false) as IProjectChange])).toBe(
				'The project was restored.'
			);
			expect(projectArchiveChangeOf(true, true)).toBeNull();
		});

		it('says every change in one message', () => {
			expect(
				projectChangeMessageOf([
					{ field: 'status', from: 'open', to: 'in progress' },
					{ field: 'startDate', from: null, to: '2026-11-20' }
				])
			).toBe('Status: open → in progress. Start date: none → 2026-11-20.');
		});
	});
});
