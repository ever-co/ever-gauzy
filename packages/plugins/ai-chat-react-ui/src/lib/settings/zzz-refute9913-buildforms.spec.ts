import { ChangeDetectorRef, DestroyRef, runInInjectionContext, Injector, Injectable } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

// The real ui-core barrels drag in @datorama/akita (ESM) — irrelevant to this probe.
// Only the DI TOKEN identity matters, so stub the barrels but keep the COMPONENT real.
jest.mock('@gauzy/ui-core/core', () => {
	class Store {}
	class ChatSidebarService {}
	return { Store, ChatSidebarService };
});
jest.mock('@gauzy/ui-core/shared', () => ({ ConfirmComponent: class ConfirmComponent {} }));
jest.mock('../ai-chat-availability.service', () => {
	class AiChatAvailabilityService {}
	return { AiChatAvailabilityService };
});

/* eslint-disable @typescript-eslint/no-var-requires */
import { ChatSidebarService, Store } from '@gauzy/ui-core/core';
import { AiChatAvailabilityService } from '../ai-chat-availability.service';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { AiChatSettingsComponent } from './ai-chat-settings.component';

const CUSTOM_MODEL = '__custom__';

/** A model id that exists ONLY in the live catalogue, never in the curated list. */
const LIVE_ONLY = 'openai/gpt-5-live-only';

const OPENAI: any = {
	id: 'openai',
	label: 'OpenAI',
	configured: true,
	credentialSource: 'tenant',
	models: [{ id: 'gpt-4o', label: 'GPT-4o', providerId: 'openai' }]
};
const OPENROUTER: any = {
	id: 'openrouter',
	label: 'OpenRouter',
	configured: true,
	credentialSource: 'tenant',
	models: [{ id: 'curated-1', label: 'Curated 1', providerId: 'openrouter' }]
};

function makeCredentials(): any[] {
	return [
		{ id: 'cred-openai', providerId: 'openai', defaultModel: LIVE_ONLY, enabled: true },
		{ id: 'cred-openrouter', providerId: 'openrouter', defaultModel: 'curated-1', enabled: true }
	];
}

describe('PR #9913 buildForms() catalogue-aware knownModel — reachability probe', () => {
	let settingsService: any;
	let component: AiChatSettingsComponent;

	beforeEach(() => {
		settingsService = {
			getConfig: jest.fn(() => of({ providers: [OPENAI, OPENROUTER], defaultProvider: 'openai' })),
			getCredentials: jest.fn(() => of({ items: makeCredentials(), total: 2 })),
			getProviderModels: jest.fn((providerId: string) =>
				of(
					providerId === 'openai'
						? {
								providerId,
								source: 'live',
								models: [
									{ id: 'gpt-4o', label: 'GPT-4o', providerId },
									{ id: LIVE_ONLY, label: 'GPT-5 (live only)', providerId }
								]
						  }
						: { providerId, source: 'live', models: [{ id: 'curated-1', label: 'Curated 1', providerId }] }
				)
			),
			updateCredential: jest.fn(() => of({})),
			upsertCredential: jest.fn(() => of({})),
			deleteCredential: jest.fn(() => of({}))
		};

		const injector = Injector.create({
			providers: [
				{ provide: FormBuilder, useValue: new FormBuilder() },
				{ provide: AiChatSettingsService, useValue: settingsService },
				{ provide: Store, useValue: { user: { tenantId: 't1' }, organizationId: 'o1' } },
				{ provide: AiChatAvailabilityService, useValue: { refresh: jest.fn() } },
				{ provide: ChatSidebarService, useValue: { expand: jest.fn() } },
				{ provide: NbDialogService, useValue: { open: jest.fn(() => ({ onClose: of(true) })) } },
				{ provide: NbToastrService, useValue: { success: jest.fn(), danger: jest.fn(), warning: jest.fn() } },
				{ provide: TranslateService, useValue: { instant: (key: string) => key } },
				{ provide: Router, useValue: { navigate: jest.fn(() => Promise.resolve(true)) } },
				{
					provide: ActivatedRoute,
					useValue: { snapshot: { queryParamMap: new Map() }, queryParamMap: of(new Map()) }
				},
				{ provide: ChangeDetectorRef, useValue: { markForCheck: jest.fn(), detectChanges: jest.fn() } },
				{ provide: DestroyRef, useValue: { onDestroy: () => () => undefined } }
			]
		});

		component = runInInjectionContext(injector, () => new AiChatSettingsComponent());
	});

	function formSnapshot(providerId: string) {
		const form = component.getForm(providerId);
		return {
			defaultModel: form.controls.defaultModel.value,
			customModel: form.controls.customModel.value
		};
	}

	it('DOES see a cached catalogue on a mutation path (toggleEnabled of a DIFFERENT provider)', () => {
		// 1. Initial load: no catalogue anywhere → the live-only id can only render as "custom".
		component.load();
		expect(formSnapshot('openai')).toEqual({ defaultModel: CUSTOM_MODEL, customModel: LIVE_ONLY });

		// 2. Opening OpenAI's config view fetches its catalogue; reconcile promotes it to a real selection.
		component.loadModels('openai');
		expect(formSnapshot('openai')).toEqual({ defaultModel: LIVE_ONLY, customModel: '' });

		// 3. MUTATION: invalidateCatalogue('openrouter') + load() + buildForms() for ALL providers.
		component.toggleEnabled(OPENROUTER, false);

		// 4. buildForms() saw openai's still-cached catalogue: NO demotion to "custom".
		//    origin/develop's `provider.models.some(...)` would yield CUSTOM_MODEL here.
		expect(formSnapshot('openai')).toEqual({ defaultModel: LIVE_ONLY, customModel: '' });
	});

	it('DOES see a cached catalogue on the toggleEnabled ERROR path (no invalidateCatalogue at all)', () => {
		component.load();
		component.loadModels('openai');
		expect(formSnapshot('openai')).toEqual({ defaultModel: LIVE_ONLY, customModel: '' });

		settingsService.updateCredential = jest.fn(() => throwError(() => new Error('boom')));
		component.toggleEnabled(OPENAI, false); // error branch → this.load() with no invalidation

		expect(settingsService.updateCredential).toHaveBeenCalled();
		expect(formSnapshot('openai')).toEqual({ defaultModel: LIVE_ONLY, customModel: '' });
	});

	it('same-provider save re-derives from curated (the finding scenario) and recovers on re-open', () => {
		component.load();
		component.loadModels('openai');
		expect(formSnapshot('openai')).toEqual({ defaultModel: LIVE_ONLY, customModel: '' });

		component.save(OPENAI);
		// The state the finding describes — byte-identical to what origin/develop ALWAYS produced.
		expect(formSnapshot('openai')).toEqual({ defaultModel: CUSTOM_MODEL, customModel: LIVE_ONLY });
		// The id is NOT lost: it is carried in customModel and still saved.

		// Re-opening the config view re-fetches (the cache was invalidated) and reconciles back.
		component.loadModels('openai');
		expect(formSnapshot('openai')).toEqual({ defaultModel: LIVE_ONLY, customModel: '' });
		expect(settingsService.getProviderModels).toHaveBeenCalledTimes(2);
	});

	it('a still-cached catalogue is NEVER re-fetched, so buildForms() is the only guard for it', () => {
		component.load();
		component.loadModels('openai');
		expect(settingsService.getProviderModels).toHaveBeenCalledTimes(1);

		component.toggleEnabled(OPENROUTER, false); // mutation elsewhere
		component.loadModels('openai'); // re-open openai's config view

		// Early-returns on the warm cache → reconcileModelSelection() never runs again.
		expect(settingsService.getProviderModels).toHaveBeenCalledTimes(1);
		expect(formSnapshot('openai')).toEqual({ defaultModel: LIVE_ONLY, customModel: '' });
	});
});

// Keep the unused Observable/Injectable imports honest for the linter.
void Observable;
void Injectable;
