import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { environment } from '@gauzy/ui-config';
import { AppService } from '@gauzy/ui-core/core';
import { ISignInProvider, SocialLinksComponent, configuredSignInLink } from './social-links.component';
import { EverIdLoginLabelComponent, everIdLoginLabelParts } from './ever-id-login-label.component';

describe('SocialLinksComponent', () => {
	let component: SocialLinksComponent;
	let fixture: ComponentFixture<SocialLinksComponent>;
	let http: HttpTestingController;
	const saved = { zitadel: environment.ZITADEL_AUTH_LINK, keycloak: environment.KEYCLOAK_AUTH_LINK };

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [SocialLinksComponent],
			imports: [NbButtonModule, NbIconModule, EverIdLoginLabelComponent],
			providers: [{ provide: AppService, useValue: { getAppConfigs: () => of({}) } }]
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		environment.ZITADEL_AUTH_LINK = saved.zitadel;
		environment.KEYCLOAK_AUTH_LINK = saved.keycloak;
	});

	function create(): ISignInProvider[] {
		fixture = TestBed.createComponent(SocialLinksComponent);
		component = fixture.componentInstance;
		let providers: ISignInProvider[] = [];
		component.ngOnInit();
		component.signInProviders$.subscribe((value) => (providers = value));
		return providers;
	}

	it('should create', () => {
		environment.ZITADEL_AUTH_LINK = '';
		environment.KEYCLOAK_AUTH_LINK = '';
		create();
		expect(component).toBeTruthy();
	});

	it('shows no sign-in plugin button and makes no request while no link is configured', () => {
		environment.ZITADEL_AUTH_LINK = '';
		environment.KEYCLOAK_AUTH_LINK = '';
		const providers = create();
		expect(providers).toEqual([]);
		http.expectNone(() => true);
		http.verify();
	});

	it('shows Ever ID first and prominent when its link is set and the API reports it enabled', () => {
		environment.ZITADEL_AUTH_LINK = 'http://localhost:3000/api/auth/zitadel';
		environment.KEYCLOAK_AUTH_LINK = 'http://localhost:3000/api/auth/keycloak';
		let providers: ISignInProvider[] = [];
		fixture = TestBed.createComponent(SocialLinksComponent);
		component = fixture.componentInstance;
		component.ngOnInit();
		component.signInProviders$.subscribe((value) => (providers = value));

		http.expectOne((request) => request.url.endsWith('/auth/zitadel/config')).flush({ enabled: true });
		http.expectOne((request) => request.url.endsWith('/auth/keycloak/config')).flush({ enabled: true });

		expect(providers.map((provider) => [provider.id, provider.prominent])).toEqual([
			['ever-id', true],
			['keycloak', false]
		]);
		expect(providers[0].url).toBe('http://localhost:3000/api/auth/zitadel');
	});

	it('hides a button whose plugin is off on the API (404)', () => {
		environment.ZITADEL_AUTH_LINK = 'http://localhost:3000/api/auth/zitadel';
		environment.KEYCLOAK_AUTH_LINK = '';
		let providers: ISignInProvider[] = [{} as ISignInProvider];
		fixture = TestBed.createComponent(SocialLinksComponent);
		component = fixture.componentInstance;
		component.ngOnInit();
		component.signInProviders$.subscribe((value) => (providers = value));
		http.expectOne((request) => request.url.endsWith('/auth/zitadel/config')).flush({}, { status: 404, statusText: 'Not Found' });
		expect(providers).toEqual([]);
	});

	it('treats an unreplaced Docker placeholder as not configured', () => {
		expect(configuredSignInLink('DOCKER_ZITADEL_AUTH_LINK')).toBe('');
		expect(configuredSignInLink('  ')).toBe('');
		expect(configuredSignInLink(undefined)).toBe('');
		expect(configuredSignInLink('https://api.example.test/api/auth/zitadel')).toBe('https://api.example.test/api/auth/zitadel');
	});
});

describe('"Login with Ever ID" label', () => {
	const mark = (text: string) => text.replace('{{ everId }}', '\u2063EVER_ID\u2063');

	it('keeps the words around the wordmark in the order of each language', () => {
		expect(everIdLoginLabelParts(mark('Login with {{ everId }}'))).toEqual({
			before: 'Login with',
			after: '',
			label: 'Login with Ever ID'
		});
		expect(everIdLoginLabelParts(mark('Mit {{ everId }} anmelden'))).toEqual({
			before: 'Mit',
			after: 'anmelden',
			label: 'Mit Ever ID anmelden'
		});
		expect(everIdLoginLabelParts(mark('使用 {{ everId }} 登录'))).toEqual({
			before: '使用',
			after: '登录',
			label: '使用 Ever ID 登录'
		});
	});

	it('reads "Login with Ever ID" when the translation is missing', () => {
		expect(everIdLoginLabelParts('LOGIN_PAGE.LOGIN_WITH_EVER_ID')).toEqual({
			before: 'Login with',
			after: '',
			label: 'Login with Ever ID'
		});
	});
});

describe('EverIdLoginLabelComponent (rendered)', () => {
	function render(language: string) {
		TestBed.configureTestingModule({
			imports: [EverIdLoginLabelComponent],
			providers: [provideTranslateService()]
		});
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', { LOGIN_PAGE: { LOGIN_WITH_EVER_ID: 'Login with {{ everId }}' } });
		translate.setTranslation('de', { LOGIN_PAGE: { LOGIN_WITH_EVER_ID: 'Mit {{ everId }} anmelden' } });
		translate.use(language);
		const fixture = TestBed.createComponent(EverIdLoginLabelComponent);
		fixture.detectChanges();
		return { element: fixture.nativeElement as HTMLElement, fixture, translate };
	}

	afterEach(() => TestBed.resetTestingModule());

	it('gives screen readers the whole label once and only draws the star, the words and the wordmark', () => {
		const { element } = render('en');

		expect(element.querySelector('.visually-hidden')?.textContent?.trim()).toBe('Login with Ever ID');
		expect(element.querySelector('.label')?.getAttribute('aria-hidden')).toBe('true');
		expect(element.querySelector('.label')?.textContent?.trim()).toBe('Login with');
		const svgs = Array.from(element.querySelectorAll('svg'));
		expect(svgs.map((svg) => svg.getAttribute('viewBox'))).toEqual(['0 0 40 42', '0 0 92 17']);
		expect(svgs.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
	});

	it('follows the language, keeping its word order', () => {
		const { element, fixture, translate } = render('en');

		translate.use('de');
		fixture.detectChanges();

		expect(element.querySelector('.visually-hidden')?.textContent?.trim()).toBe('Mit Ever ID anmelden');
		const words = Array.from(element.querySelectorAll('.label > span')).map((span) => span.textContent?.trim());
		expect(words).toEqual(['Mit', 'anmelden']);
	});
});
