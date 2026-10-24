import { of, Subject } from 'rxjs';
import { IUser, KeyResultTypeEnum, PermissionsEnum, RolesEnum, TaskStatusEnum } from '@gauzy/contracts';
import { KeyResultDetailsComponent } from './keyresult-details.component';

/**
 * Owner decision 2(a) (2026-10-23): the server applies a filed progress update to its key result and goal, so the
 * details dialog files the update and re-reads the key result. It no longer writes the key result back with
 * `PUT /key-results/:id`, which needs `GOALS_EDIT` and refused an employee reporting their own key result.
 *
 * Only the methods are exercised, on a bare instance: no template or DI is needed.
 */
describe('KeyResultDetailsComponent — reporting progress', () => {
	const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };

	const build = (keyResult: Record<string, unknown>, dialogAnswer: unknown, permissions: PermissionsEnum[] = []) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(KeyResultDetailsComponent.prototype);
		const keyResultService = {
			update: jest.fn(),
			findKeyResult: jest.fn().mockResolvedValue({ items: [{ ...keyResult, updates: [] }] })
		};
		const keyResultUpdateService = { createUpdate: jest.fn().mockResolvedValue({ id: 'update-1' }) };
		Object.assign(component, {
			keyResult: { ...keyResult },
			task: { id: 'task-1' },
			dialogService: { open: jest.fn(() => ({ onClose: of(dialogAnswer) })) },
			keyResultService,
			keyResultUpdateService,
			_store: { editTask: jest.fn(() => of(null)) },
			_ngDestroy$: new Subject<void>(),
			chart: { updateChart: jest.fn() },
			store: {
				selectedOrganization: ORGANIZATION,
				hasPermission: (permission: PermissionsEnum) => permissions.includes(permission)
			}
		});
		return { component, keyResultService, keyResultUpdateService };
	};

	it('re-reads the key result after the update dialog files a report, and writes nothing back', async () => {
		const keyResult = { id: 'kr-1', type: KeyResultTypeEnum.NUMERICAL, owner: { id: 'employee-1' } };
		const { component, keyResultService } = build(keyResult, { ...keyResult, update: 5, progress: 50 });

		await component.keyResultUpdate();

		expect(keyResultService.update).not.toHaveBeenCalled();
		expect(keyResultService.findKeyResult).toHaveBeenCalledWith('kr-1');
	});

	it('files a task key result’s report with its organization, and writes nothing back', async () => {
		const keyResult = { id: 'kr-2', type: KeyResultTypeEnum.TASK, owner: { id: 'employee-1' } };
		const { component, keyResultService, keyResultUpdateService } = build(keyResult, {
			status: TaskStatusEnum.COMPLETED,
			estimateDays: 0,
			estimateHours: 0,
			estimateMinutes: 0
		});

		await component.keyResultUpdate();

		expect(keyResultUpdateService.createUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				keyResultId: 'kr-2',
				update: 1,
				organizationId: ORGANIZATION.id,
				tenantId: ORGANIZATION.tenantId
			})
		);
		expect(keyResultService.update).not.toHaveBeenCalled();
		expect(keyResultService.findKeyResult).toHaveBeenCalledWith('kr-2');
	});

	describe('who is offered the Update button', () => {
		const keyResult = { id: 'kr-1', owner: { id: 'owner-employee' }, lead: { id: 'lead-employee' } };
		const user = (role: RolesEnum, employeeId?: string) =>
			({ role: { name: role }, employee: employeeId ? { id: employeeId } : undefined }) as unknown as IUser;
		const offered = (signedIn: IUser, permissions: PermissionsEnum[] = [], reportedOn = keyResult): boolean =>
			build(reportedOn, null, permissions).component.mayReportProgress(signedIn);

		it('offers it to the owner, the lead, a GOALS_EDIT holder and a tenant administrator', () => {
			expect(offered(user(RolesEnum.EMPLOYEE, 'owner-employee'))).toBe(true);
			expect(offered(user(RolesEnum.EMPLOYEE, 'lead-employee'))).toBe(true);
			expect(offered(user(RolesEnum.MANAGER, 'manager-employee'), [PermissionsEnum.GOALS_EDIT])).toBe(true);
			expect(offered(user(RolesEnum.ADMIN))).toBe(true);
		});

		it('withholds it from any other employee, also on a key result without a lead', () => {
			expect(offered(user(RolesEnum.EMPLOYEE, 'other-employee'))).toBe(false);
			expect(offered(user(RolesEnum.EMPLOYEE, 'other-employee'), [], { ...keyResult, lead: null })).toBe(false);
		});
	});
});
