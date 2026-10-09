import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageElectronService } from '@gauzy/desktop-ui-lib';
import { AppComponent } from './app.component';

/**
 * The root shell of the Gauzy Server renderer: a router outlet, plus the Electron language bridge
 * started on init. This spec began as the 2021 Angular CLI scaffold (a `title` of 'desktop-web-ui' and
 * an h1 "Welcome to desktop-web-ui!"); the component replaced that placeholder long ago and the spec
 * never ran, so those two cases now assert what the shell really does. The component is standalone
 * (imported, not declared), and the language service talks to Electron IPC, so it is a stand-in here.
 *
 * The library entry point is mocked down to that one token: loading it for real pulls every desktop
 * feature module (ngx-charts and the d3 tree among them) into a spec that uses none of them, which
 * took this three-case suite ~15 minutes on a cold transform cache.
 */
jest.mock('@gauzy/desktop-ui-lib', () => ({ LanguageElectronService: class LanguageElectronService {} }));

describe('AppComponent', () => {
	const languageElectronService = { initialize: jest.fn() };

	beforeEach(async () => {
		languageElectronService.initialize.mockClear();
		await TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [provideRouter([]), { provide: LanguageElectronService, useValue: languageElectronService }]
		}).compileComponents();
	});
	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent);
		const app = fixture.componentInstance;
		expect(app).toBeTruthy();
	});
	it('starts the Electron language bridge on init', () => {
		const fixture = TestBed.createComponent(AppComponent);
		fixture.detectChanges();
		expect(languageElectronService.initialize).toHaveBeenCalledTimes(1);
	});
	it('renders the router outlet as the whole shell', () => {
		const fixture = TestBed.createComponent(AppComponent);
		fixture.detectChanges();
		const compiled: HTMLElement = fixture.nativeElement;
		expect(compiled.querySelector('router-outlet')).toBeTruthy();
		expect(compiled.children).toHaveLength(1);
	});
});
