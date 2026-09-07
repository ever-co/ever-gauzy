import { Injector, runInInjectionContext } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { ErrorHandlingService, Store, ToastrService } from '@gauzy/ui-core/core';
import {
	EverAsyncService,
	IEverAsyncSettingsResponse,
	IEverAsyncSetupResponse
} from '../../services/ever-async.service';
import { EverAsyncConnectComponent } from './ever-async-connect.component';

jest.mock('@gauzy/ui-config', () => ({ environment: { API_BASE_URL: 'https://api.gauzy.example' } }), {
	virtual: true
});
jest.mock('@gauzy/ui-core/core', () => ({ Store: class {}, ErrorHandlingService: class {}, ToastrService: class {} }), {
	virtual: true
});
jest.mock(
	'@gauzy/ui-core/i18n',
	() => ({
		TranslationBaseComponent: class {
			getTranslation(key: string) {
				return key;
			}
		}
	}),
	{ virtual: true }
);
jest.mock('@gauzy/ui-core/common', () => ({ API_PREFIX: '/api' }), { virtual: true });
jest.mock('@gauzy/contracts', () => ({ PermissionsEnum: { INTEGRATION_EDIT: 'edit', INTEGRATION_ADD: 'add' } }), {
	virtual: true
});

describe('EverAsyncConnectComponent request lifetime', () => {
	const orgA = { id: 'organization-a' } as IOrganization;
	const orgB = { id: 'organization-b' } as IOrganization;
	const savedSettings: IEverAsyncSettingsResponse = {
		integrationTenantId: 'integration-a',
		tenantId: 'tenant-a',
		organizationId: orgA.id,
		serverUrl: 'https://api-async.ever.co',
		projectIds: [],
		userMappings: [],
		isEnabled: true,
		hasApiKey: true
	};
	const credential = (apiKey: string): IEverAsyncSetupResponse => ({
		integrationTenantId: 'integration-a',
		tenantId: 'tenant-a',
		organizationId: orgA.id,
		apiKey,
		apiSecret: 'synthetic-test-secret'
	});
	let organizations: BehaviorSubject<IOrganization>;
	let component: EverAsyncConnectComponent;
	let service: {
		getOptions: jest.Mock;
		getSettings: jest.Mock;
		rotateCredentials: jest.Mock;
		updateSettings: jest.Mock;
		setup: jest.Mock;
		verify: jest.Mock;
	};
	let errors: { handleError: jest.Mock };
	let toastr: { success: jest.Mock };

	beforeEach(() => {
		environment.API_BASE_URL = 'https://api.gauzy.example';
		organizations = new BehaviorSubject(orgA);
		errors = { handleError: jest.fn() };
		toastr = { success: jest.fn() };
		service = {
			getOptions: jest.fn(() => of({ employees: [], projects: [] })),
			getSettings: jest.fn((organizationId: string) => of({ ...savedSettings, organizationId })),
			rotateCredentials: jest.fn(),
			updateSettings: jest.fn(),
			setup: jest.fn(),
			verify: jest.fn()
		};
		const injector = Injector.create({
			providers: [
				{ provide: Store, useValue: { selectedOrganization$: organizations, hasPermission: () => true } },
				{ provide: EverAsyncService, useValue: service },
				{ provide: ErrorHandlingService, useValue: errors },
				{ provide: ToastrService, useValue: toastr },
				{ provide: Location, useValue: { back: jest.fn() } }
			]
		});
		component = runInInjectionContext(injector, () => new EverAsyncConnectComponent({} as TranslateService));
		component.ngOnInit();
	});
	afterEach(() => {
		(component as unknown as { ngOnDestroy: () => void }).ngOnDestroy();
		organizations.complete();
	});

	function revisit() {
		organizations.next(orgB);
		organizations.next(orgA);
	}

	it('keeps the newest one-time credentials after an A to B to A switch', () => {
		const first = new Subject<IEverAsyncSetupResponse>();
		const second = new Subject<IEverAsyncSetupResponse>();
		service.rotateCredentials.mockReturnValueOnce(first).mockReturnValueOnce(second);
		component.rotateCredentials();
		revisit();
		component.rotateCredentials();
		second.next(credential('current-key'));
		first.next(credential('revoked-key'));
		expect(component.credentials()?.apiKey).toBe('current-key');
		expect(component.loading()).toBe(false);
	});

	it('does not overwrite fresh settings with a late save response', () => {
		const pending = new Subject<void>();
		service.updateSettings.mockReturnValue(pending);
		component.form.controls.serverUrl.setValue('https://old-request.example');
		component.connect();
		revisit();
		pending.next();
		expect(component.settings()?.serverUrl).toBe(savedSettings.serverUrl);
		expect(toastr.success).not.toHaveBeenCalled();
	});

	it('discards a late setup response and does not replace the new organization visit', () => {
		const pending = new Subject<IEverAsyncSetupResponse>();
		service.setup.mockReturnValue(pending);
		component.settings.set(null);
		component.connect();
		revisit();
		pending.next(credential('old-setup-key'));
		expect(component.credentials()).toBeNull();
		expect(component.settings()).toEqual(savedSettings);
	});

	it('ignores old mutation failures while a new request is pending', () => {
		const first = new Subject<IEverAsyncSetupResponse>();
		const second = new Subject<IEverAsyncSetupResponse>();
		service.rotateCredentials.mockReturnValueOnce(first).mockReturnValueOnce(second);
		component.rotateCredentials();
		revisit();
		component.rotateCredentials();
		first.error(new HttpErrorResponse({ status: 502 }));
		expect(component.loading()).toBe(true);
		expect(errors.handleError).not.toHaveBeenCalled();
	});

	it('ignores verification from an earlier organization visit', () => {
		const first = new Subject<{ ok: boolean }>();
		const second = new Subject<{ ok: boolean }>();
		service.verify.mockReturnValueOnce(first).mockReturnValueOnce(second);
		component.testConnection();
		revisit();
		component.testConnection();
		first.next({ ok: true });
		expect(component.verifying()).toBe(true);
		expect(component.connectionOk()).toBeNull();
		second.next({ ok: true });
		expect(component.connectionOk()).toBe(true);
	});

	it('preserves the URL guard for a late failed reachability check', () => {
		const pending = new Subject<{ ok: boolean }>();
		service.verify.mockReturnValue(pending);
		component.testConnection();
		component.form.controls.serverUrl.setValue('https://new-server.example');
		pending.error(new HttpErrorResponse({ status: 502 }));
		expect(component.connectionOk()).toBeNull();
		expect(errors.handleError).not.toHaveBeenCalled();
	});

	it('uses the configured API base and lets the Async connector add /api', () => {
		environment.API_BASE_URL = 'https://api.gauzy.example/';
		expect(component.gauzyApiUrl).toBe('https://api.gauzy.example');
		expect(component.connectorConfig).toContain('base_url = "https://api.gauzy.example"');
		environment.API_BASE_URL = '';
		expect(component.gauzyApiUrl).toBe(window.location.origin);
	});
});
