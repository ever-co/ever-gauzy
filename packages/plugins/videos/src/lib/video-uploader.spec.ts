// `@gauzy/core` drags in the entity graph; the rule only reads the caller from the request context.
const mockCaller = { employeeId: 'employee-own' as string | null, mayActForOthers: false };
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		currentEmployeeId: () => mockCaller.employeeId,
		hasPermission: () => mockCaller.mayActForOthers
	}
}));

import { videoUploaderOf } from './video-uploader';

/**
 * `POST /videos` filed a recording under the body's `uploadedById`, so an employee could put one in a colleague's
 * recordings. Only a caller who may act for other employees names the uploader now, as for camshots and soundshots.
 */
describe('videoUploaderOf', () => {
	beforeEach(() => {
		mockCaller.employeeId = 'employee-own';
		mockCaller.mayActForOthers = false;
	});

	it('files an employee’s upload under themselves, whatever the body names', () => {
		expect(videoUploaderOf('employee-colleague')).toBe('employee-own');
		expect(videoUploaderOf(undefined)).toBe('employee-own');
	});

	it('files it under no one for a caller without an employee record', () => {
		mockCaller.employeeId = null;

		expect(videoUploaderOf('employee-colleague')).toBeNull();
	});

	it('lets a caller with CHANGE_SELECTED_EMPLOYEE name the uploader', () => {
		mockCaller.mayActForOthers = true;

		expect(videoUploaderOf('employee-colleague')).toBe('employee-colleague');
		expect(videoUploaderOf(undefined)).toBe('employee-own');
	});
});
