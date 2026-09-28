/**
 * Default TestBed environment for the Angular Jest projects — a `setupFilesAfterEnv` entry listed
 * AFTER each project's own `src/test-setup.ts` (which starts the zone test environment).
 *
 * Why: most component specs in the Angular projects are the `should create` stubs the Angular CLI
 * generated, and none of them had ever run (the Unit Tests workflow is new, and until the harness
 * fixes that come with this file every Angular suite failed to load). Written against an empty
 * testing module, they fail on the first injection the component makes — `TranslateService`,
 * `NbToastrService`, `NbDialogRef`, `ActivatedRoute`, the `translate` pipe — which is app-wide
 * infrastructure, not what those specs are about. This file provides that infrastructure the way
 * the app's root module does, once, instead of pasting the same provider list into ~100 specs.
 *
 * How: a top-level `beforeEach` adds these imports/providers to the testing module before any spec's
 * own `beforeEach`. `TestBed.configureTestingModule` MERGES successive calls, and a later provider
 * wins, so a spec that provides its own `TranslateService`, `NbDialogRef` or route stub still gets
 * its own. Nothing is compiled until a spec asks TestBed for something, so specs that never touch
 * TestBed pay only the import cost.
 *
 * Deliberately NOT here: feature services and stores (a spec that needs one should say so), and
 * `NO_ERRORS_SCHEMA` (the zone test env errors on unknown elements, and that stays on). Keep the
 * imports to third-party modules and leaf workspace modules: this file loads BEFORE each spec, so
 * importing e.g. `@gauzy/ui-core/core` here would cache the real modules that a spec later replaces
 * with `jest.mock(...)` (chat-sidebar.service.spec does), and the mock would silently not apply.
 */
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import {
	NbDatepickerModule,
	NbDialogModule,
	NbDialogRef,
	NbMenuModule,
	NbSidebarModule,
	NbThemeModule,
	NbToastrModule,
	NbWindowModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { environment, GAUZY_ENV } from '@gauzy/ui-config';
import { TablerIconsModule } from '@gauzy/ui-core/icons';

// jsdom implements no `matchMedia`; Nebular's layout/breakpoint services and several components call
// it. Browsers always have it. An inert stand-in that matches nothing (a spec that cares can replace it).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		configurable: true,
		value: (query: string): MediaQueryList =>
			({
				matches: false,
				media: query,
				onchange: null,
				addListener: () => undefined,
				removeListener: () => undefined,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
				dispatchEvent: () => false
			}) as MediaQueryList
	});
}

/** What a component opened by `NbDialogService` receives. Specs that assert on `close` spy on it. */
const dialogRefStub: Partial<NbDialogRef<unknown>> = {
	close: () => undefined
};

beforeEach(() => {
	TestBed.configureTestingModule({
		imports: [
			// No loader: `translate` returns the key, which is all a unit test should depend on.
			TranslateModule.forRoot(),
			NbThemeModule.forRoot({ name: 'default' }),
			NbDialogModule.forRoot(),
			NbToastrModule.forRoot(),
			NbWindowModule.forRoot(),
			NbSidebarModule.forRoot(),
			NbMenuModule.forRoot(),
			NbDatepickerModule.forRoot(),
			// The app root module's forRoot; feature modules only call forChild.
			NgxPermissionsModule.forRoot(),
			// Registers the default icon pack ('eva', mapped to Tabler); without it every <nb-icon> throws
			// "Default pack is not registered".
			TablerIconsModule
		],
		providers: [
			provideHttpClient(),
			// Requests are recorded, never sent; nothing is flushed unless a spec does it.
			provideHttpClientTesting(),
			provideRouter([]),
			provideNoopAnimations(),
			{ provide: NbDialogRef, useValue: dialogRefStub },
			{ provide: GAUZY_ENV, useValue: environment }
		]
	});
});
