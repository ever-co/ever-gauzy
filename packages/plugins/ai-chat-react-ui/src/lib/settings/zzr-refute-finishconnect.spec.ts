/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PROBE (throwaway): does finishConnect()'s `invalidateCatalogue(selectedProviderId())`
 * fail to invalidate the connected provider's catalogue on the PKCE return trip?
 */
jest.mock(
	'@gauzy/ui-core/core',
	() => ({
		Store: class Store {
			user: any = { tenantId: 't1' };
			organizationId: any = 'o1';
		},
		ChatSidebarService: class ChatSidebarService {
			expand() {}
		}
	}),
	{ virtual: true }
);
jest.mock('@gauzy/ui-core/shared', () => ({ ConfirmComponent: class ConfirmComponent {} }), { virtual: true });
jest.mock('@gauzy/ui-config', () => ({ environment: { API_BASE_URL: 'http://localhost:3000' } }), { virtual: true });

import { ChangeDetectorRef, DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { Store, ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatAvailabilityService } from '../ai-chat-availability.service';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { AiChatSettingsComponent } from './ai-chat-settings.component';

const PROVIDERS = [
	{ id: 'openrouter', label: 'OpenRouter', configured: true, models: [{ id: 'curated-a', label: 'Curated A' }] },
	{ id: 'openai', label: 'OpenAI', configured: true, models: [{ id: 'curated-b', label: 'Curated B' }] }
];

function build(queryParams: Record<string, string>, asyncConnect = false) {
	const params$ = new BehaviorSubject(convertToParamMap(queryParams));
	const getProviderModels = jest.fn((providerId: string) =>
		of({ models: [{ id: `live-${providerId}`, label: `Live ${providerId}` }], source: 'live' } as any)
	);
	// Real HTTP settles AFTER ngOnInit has registered the queryParamMap subscription;
	// `asyncConnect` reproduces that ordering (the response is emitted by the test).
	const connectResponse$ = new Subject<any>();
	const connectCredential = jest.fn(() => (asyncConnect ? connectResponse$.asObservable() : of({ id: 'cred-1' })));
	const settings = {
		getConfig: jest.fn(() => of({ providers: PROVIDERS, defaultProvider: null } as any)),
		getCredentials: jest.fn(() => of({ items: [], total: 0 } as any)),
		getProviderModels,
		connectCredential,
		updateCredential: jest.fn(() => of({} as any)),
		createCredential: jest.fn(() => of({} as any)),
		deleteCredential: jest.fn(() => of({} as any))
	};
	const navigate = jest.fn(() => Promise.resolve(true));

	const injector = Injector.create({
		providers: [
			{ provide: FormBuilder, useValue: new FormBuilder() },
			{ provide: DestroyRef, useValue: { onDestroy: () => () => undefined } },
			{ provide: ChangeDetectorRef, useValue: { markForCheck: () => undefined, detectChanges: () => undefined } },
			{ provide: Store, useValue: { user: { tenantId: 't1' }, organizationId: 'o1' } },
			{ provide: ChatSidebarService, useValue: { expand: () => undefined } },
			{ provide: AiChatAvailabilityService, useValue: { refresh: () => undefined } },
			{ provide: AiChatSettingsService, useValue: settings },
			{ provide: NbDialogService, useValue: { open: () => ({ onClose: of(false) }) } },
			{
				provide: NbToastrService,
				useValue: { success: () => undefined, danger: () => undefined, warning: () => undefined }
			},
			{ provide: TranslateService, useValue: { instant: (k: string) => k } },
			{ provide: Router, useValue: { navigate } },
			{
				provide: ActivatedRoute,
				useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) }, queryParamMap: params$ }
			}
		]
	});

	const component = runInInjectionContext(injector, () => new AiChatSettingsComponent());
	return { component, settings, params$, navigate, getProviderModels, connectCredential, connectResponse$ };
}

function catalogueMap(component: AiChatSettingsComponent): Map<string, any> {
	return (component as any).modelCatalogues();
}

describe('PR #9913 — finishConnect() catalogue invalidation on the PKCE return trip', () => {
	beforeEach(() => {
		sessionStorage.clear();
		sessionStorage.setItem(
			'gauzy_ai_provider_connect',
			JSON.stringify({ providerId: 'openrouter', verifier: 'v', tenantId: 't1', organizationId: 'o1' })
		);
	});

	it('ARM 1 — return URL carries only ?code=: selectedProviderId is null, but NOTHING is cached to invalidate', () => {
		const { component, getProviderModels, connectCredential, params$ } = build({ code: 'CODE' });

		component.ngOnInit();

		// The exchange ran for the pending provider…
		expect(connectCredential).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'openrouter' }));
		// …and the reviewer's premise holds: no ?provider= on the return trip.
		expect(component.selectedProviderId()).toBeNull();
		expect(component.view()).toBe('list');

		// But the SAME guard that leaves the signal null also means no catalogue was ever fetched.
		expect(getProviderModels).not.toHaveBeenCalled();
		expect(catalogueMap(component).size).toBe(0);

		// The reviewer's proposed fix (pass pending.providerId) applied by hand => identical state.
		(component as any).invalidateCatalogue('openrouter');
		expect(catalogueMap(component).size).toBe(0);

		// USER-VISIBLE POST-CONDITION: opening the provider's config view after Connect
		// fetches a FRESH catalogue (nothing stale was cached to short-circuit it).
		params$.next(convertToParamMap({ provider: 'openrouter' }));
		expect(getProviderModels).toHaveBeenCalledWith('openrouter');
		expect(catalogueMap(component).get('openrouter').models[0].id).toBe('live-openrouter');
	});

	it('ARM 1b — real ordering (async exchange): the map is still empty when finishConnect runs', () => {
		const { component, getProviderModels, connectResponse$ } = build({ code: 'CODE' }, true);

		component.ngOnInit();
		// subscription has fired; no ?provider= => nothing fetched
		expect(getProviderModels).not.toHaveBeenCalled();
		expect(catalogueMap(component).size).toBe(0);

		connectResponse$.next({ id: 'cred-1' }); // -> finishConnect()
		connectResponse$.complete();

		expect(component.selectedProviderId()).toBeNull();
		expect(catalogueMap(component).size).toBe(0); // nothing existed to invalidate, right id or not
	});

	it('ARM 2 (control) — whenever a catalogue IS cached, the guard drops exactly that provider', () => {
		const { component, getProviderModels, connectResponse$ } = build({ code: 'CODE', provider: 'openrouter' }, true);

		component.ngOnInit();

		expect(getProviderModels).toHaveBeenCalledWith('openrouter');
		// the id the guard uses == the id whose catalogue is cached == the connected provider
		expect(component.selectedProviderId()).toBe('openrouter');
		expect([...catalogueMap(component).keys()]).toEqual(['openrouter']);

		connectResponse$.next({ id: 'cred-1' }); // -> finishConnect()
		connectResponse$.complete();

		expect(catalogueMap(component).size).toBe(0); // stale post-Connect catalogue dropped
	});

	it('STRUCTURAL — a catalogue can only be cached for the provider the signal points at', () => {
		const { component, params$ } = build({});
		component.ngOnInit();

		params$.next(convertToParamMap({ provider: 'openai' }));
		expect(component.selectedProviderId()).toBe('openai');
		expect([...catalogueMap(component).keys()]).toEqual(['openai']);

		params$.next(convertToParamMap({}));
		// leaving the config view empties neither, but the cached key set never grows
		// beyond providers whose config view was opened via ?provider=
		expect([...catalogueMap(component).keys()]).toEqual(['openai']);
	});
});
