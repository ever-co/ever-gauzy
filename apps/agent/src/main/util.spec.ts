/**
 * Issue #9872: the agent captures the screen only when the organisation and the employee both allow it. It stored the
 * employee's setting alone and captured on it; it now stores the organisation's setting next to it, read with the
 * employee (sign-in, start) and with the organisation's timer settings (each tracking start, then every 15 minutes).
 *
 * The settings store is an in-memory stand-in.
 */
type TStore = Record<string, any>;

const mockStore: TStore = {};

jest.mock('electron', () => ({ screen: {} }));
jest.mock('../environments/environment', () => ({ environment: {} }), { virtual: true });
jest.mock('@gauzy/desktop-lib', () => ({
	LocalStore: {
		getStore: (key: string) => mockStore[key],
		updateApplicationSetting: (values: TStore) => {
			mockStore['appSetting'] = { ...(mockStore['appSetting'] ?? {}), ...values };
		}
	}
}));

import { screenshotCaptureAllowed, updateAgentSetting, updateOrganizationScreenshotCapture } from './util';

describe('agent screen capture settings', () => {
	const employee = {
		id: 'employee-1',
		allowAgentAppExit: false,
		allowLogoutFromAgentApp: false,
		trackKeyboardMouseActivity: true,
		trackAllDisplays: false,
		randomScreenshot: false
	};

	beforeEach(() => {
		for (const key of Object.keys(mockStore)) {
			delete mockStore[key];
		}
		mockStore['appSetting'] = {};
	});

	it('does not capture an employee who allows it while the organisation does not', () => {
		updateAgentSetting({
			...employee,
			allowScreenshotCapture: true,
			organization: { allowScreenshotCapture: false }
		});

		expect(mockStore['appSetting']).toMatchObject({
			allowScreenshotCapture: true,
			organizationAllowsScreenshotCapture: false
		});
		expect(screenshotCaptureAllowed(mockStore['appSetting'])).toBe(false);
	});

	it('captures when the employee and the organisation both allow it', () => {
		updateAgentSetting({
			...employee,
			allowScreenshotCapture: true,
			organization: { allowScreenshotCapture: true }
		});

		expect(screenshotCaptureAllowed(mockStore['appSetting'])).toBe(true);
	});

	it('does not capture an employee who does not allow it, whatever the organisation says', () => {
		updateAgentSetting({
			...employee,
			allowScreenshotCapture: false,
			organization: { allowScreenshotCapture: true }
		});

		expect(screenshotCaptureAllowed(mockStore['appSetting'])).toBe(false);
	});

	it("keeps the organisation's setting read last when the employee comes without it", () => {
		mockStore['appSetting'] = { organizationAllowsScreenshotCapture: true };

		updateAgentSetting({ ...employee, allowScreenshotCapture: true });

		expect(mockStore['appSetting'].organizationAllowsScreenshotCapture).toBe(true);
		expect(screenshotCaptureAllowed(mockStore['appSetting'])).toBe(true);
	});

	it("does not capture before the organisation's setting has been read", () => {
		updateAgentSetting({ ...employee, allowScreenshotCapture: true });

		expect(screenshotCaptureAllowed(mockStore['appSetting'])).toBe(false);
	});

	it("stores the organisation's setting read with its timer settings, and says when it changed", () => {
		mockStore['appSetting'] = { allowScreenshotCapture: true, organizationAllowsScreenshotCapture: true };

		expect(updateOrganizationScreenshotCapture({ id: 'org-1', allowScreenshotCapture: false })).toBe(true);
		expect(screenshotCaptureAllowed(mockStore['appSetting'])).toBe(false);

		expect(updateOrganizationScreenshotCapture({ id: 'org-1', allowScreenshotCapture: false })).toBe(false);

		expect(updateOrganizationScreenshotCapture({ id: 'org-1', allowScreenshotCapture: true })).toBe(true);
		expect(screenshotCaptureAllowed(mockStore['appSetting'])).toBe(true);
	});

	it('changes nothing when no organisation was read', () => {
		mockStore['appSetting'] = { allowScreenshotCapture: true, organizationAllowsScreenshotCapture: true };

		expect(updateOrganizationScreenshotCapture(null)).toBe(false);
		expect(mockStore['appSetting'].organizationAllowsScreenshotCapture).toBe(true);
	});
});
