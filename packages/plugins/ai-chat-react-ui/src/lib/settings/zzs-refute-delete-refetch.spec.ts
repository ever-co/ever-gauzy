/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PROBE (throwaway): after delete()/toggleEnabled() invalidate the catalogue, does the
 * config-view picker degrade to something WRONG or EMPTY because nothing re-fetches?
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
import { BehaviorSubject, of } from 'rxjs';
import { Store, ChatSidebarService } from '@gauzy/ui-core/core';
import { AiChatAvailabilityService } from '../ai-chat-availability.service';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { AiChatSettingsComponent } from './ai-chat-settings.component';

// What the SERVER computes for /config in each credential state. getConfig() narrows
// `models` server-side to the enforced platform allowlist whenever the shared free key is
// what resolves (ai-chat.service.ts: `models: platformModels ?? definition.models`).
const CURATED = [
	{ id: 'curated-a', label: 'Curated A' },
	{ id: 'curated-b', label: 'Curated B' }
];
const PLATFORM_ALLOWLIST = [{ id: 'free-1', label: 'Free 1' }];
const LIVE = [
	{ id: 'live-1', label: 'Live 1' },
	{ id: 'live-2', label: 'Live 2' },
	{ id: 'live-3', label: 'Live 3' }
];

function build(queryParams: Record<string, string>) {
	const params$ = new BehaviorSubject(convertToParamMap(queryParams));
	// Server state: the tenant has its own key, and the provider also has a shared free key
	// behind it (so deleting the tenant key drops it onto the platform tier).
	const state = { hasTenantKey: true };

	const getConfig = jest.fn(() =>
		of({
			providers: [
				{
					id: 'openai',
					label: 'OpenAI',
					configured: true,
					credentialSource: state.hasTenantKey ? 'user' : 'platform',
					models: state.hasTenantKey ? CURATED : PLATFORM_ALLOWLIST
				}
			],
			defaultProvider: 'openai'
		} as any)
	);
	const getCredentials = jest.fn(() =>
		of({
			items: state.hasTenantKey
				? [{ id: 'cred-1', providerId: 'openai', enabled: true, defaultModel: 'live-1' }]
				: [],
			total: state.hasTenantKey ? 1 : 0
		} as any)
	);
	const getProviderModels = jest.fn(() => of({ providerId: 'openai', models: LIVE, source: 'live', stale: true } as any));
	const deleteCredential = jest.fn(() => {
		state.hasTenantKey = false;
		return of({} as any);
	});
	const updateCredential = jest.fn(() => {
		state.hasTenantKey = false; // toggled off => hands the provider back to the platform key
		return of({} as any);
	});

	const settings = {
		getConfig,
		getCredentials,
		getProviderModels,
		deleteCredential,
		updateCredential,
		upsertCredential: jest.fn(() => of({} as any)),
		connectCredential: jest.fn(() => of({} as any))
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
			{ provide: NbDialogService, useValue: { open: () => ({ onClose: of(true) }) } },
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
	return { component, settings, params$, navigate, getProviderModels, deleteCredential, updateCredential };
}

/** What the TEMPLATE evaluates: `selectedProvider()` is re-read every CD pass. */
function pickerItems(component: AiChatSettingsComponent): string[] {
	const provider = component.selectedProvider();
	return component.modelsFor(provider).map((m) => m.id);
}

describe('PR #9913 — delete()/toggleEnabled() invalidate the catalogue without a re-fetch', () => {
	it('ARM 1 — delete from the CONFIG view: the picker keeps a correct, non-empty list', () => {
		const { component, deleteCredential, getProviderModels } = build({ provider: 'openai' });
		component.ngOnInit();

		// Precondition: the live catalogue loaded and the hint explains it.
		expect(getProviderModels).toHaveBeenCalledWith('openai');
		expect(pickerItems(component)).toEqual(['live-1', 'live-2', 'live-3']);
		expect(component.modelSourceKey(component.selectedProvider())).toBe('AI_CHAT_UI.SETTINGS.FORM.MODELS_STALE');

		component.delete(component.selectedProvider());
		expect(deleteCredential).toHaveBeenCalledWith('cred-1');

		// The config view is indeed still mounted and nothing re-fetched the catalogue…
		expect(component.view()).toBe('config');
		expect(getProviderModels).toHaveBeenCalledTimes(1);

		// …but the fallback is NOT stale and NOT empty: load() re-fetched /config, and the
		// server narrowed `provider.models` for the credential state that exists AFTER the
		// delete — i.e. exactly the enforced platform allowlist the picker must offer.
		expect(pickerItems(component)).toEqual(['free-1']);
		expect(pickerItems(component).length).toBeGreaterThan(0);

		// Visible indication that state changed (badge flips; the delete button disappears
		// because the credential is gone).
		expect(component.getBadgeKey(component.selectedProvider())).toBe('AI_CHAT_UI.SETTINGS.BADGE.PLATFORM_FREE');
		expect(component.getCredential('openai')).toBeUndefined();

		// The only residual symptom: the source hint is gone.
		expect(component.modelSourceKey(component.selectedProvider())).toBeNull();
	});

	it('ARM 2 — toggleEnabled is a LIST-view action; its invalidation is honoured on the next config open', () => {
		const { component, params$, updateCredential, getProviderModels } = build({});
		component.ngOnInit();

		// Warm the catalogue the way the user would: open config, then go back to the list.
		params$.next(convertToParamMap({ provider: 'openai' }));
		expect(getProviderModels).toHaveBeenCalledTimes(1);
		params$.next(convertToParamMap({}));
		expect(component.view()).toBe('list');

		// The toggle only exists in the list view, so there is no picker/hint on screen here.
		component.toggleEnabled(component.providers()[0], false);
		expect(updateCredential).toHaveBeenCalled();

		// Re-opening the config view re-fetches, because the entry was invalidated.
		params$.next(convertToParamMap({ provider: 'openai' }));
		expect(getProviderModels).toHaveBeenCalledTimes(2);
		expect(component.modelSourceKey(component.selectedProvider())).toBe('AI_CHAT_UI.SETTINGS.FORM.MODELS_STALE');
	});

	it('BASELINE — the post-delete state equals what origin/develop always showed', () => {
		const { component } = build({ provider: 'openai' });
		component.ngOnInit();
		component.delete(component.selectedProvider());

		// develop had no catalogue endpoint at all: the picker was `provider.models` from
		// /config, with no source hint underneath. That is precisely this state.
		const provider = component.selectedProvider();
		expect(component.modelsFor(provider)).toBe(provider.models);
		expect(component.modelSourceKey(provider)).toBeNull();
	});
});
