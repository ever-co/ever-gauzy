import { presetCriterionForEmployee } from './preset-criterion-for-employee';

describe('presetCriterionForEmployee', () => {
	const criterion = {
		id: 'preset-criterion-1',
		createdAt: new Date('2026-01-01'),
		updatedAt: new Date('2026-01-02'),
		deletedAt: undefined,
		jobPresetId: 'preset-1',
		jobType: 'hourly',
		keyword: 'angular',
		tenantId: 'tenant-1',
		organizationId: 'org-1'
	};

	it("copies the criterion's values for the employee, without its id or timestamps", () => {
		expect(presetCriterionForEmployee(criterion, 'employee-b')).toEqual({
			jobPresetId: 'preset-1',
			jobType: 'hourly',
			keyword: 'angular',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			employeeId: 'employee-b'
		});
	});

	it('gives two employees saving the same preset rows of their own (no shared id)', () => {
		const first = presetCriterionForEmployee(criterion, 'employee-a');
		const second = presetCriterionForEmployee(criterion, 'employee-b');

		expect(first).not.toHaveProperty('id');
		expect(second).not.toHaveProperty('id');
		expect([first.employeeId, second.employeeId]).toEqual(['employee-a', 'employee-b']);
	});
});
