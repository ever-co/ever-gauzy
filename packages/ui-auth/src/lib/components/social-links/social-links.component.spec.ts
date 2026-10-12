import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { of } from 'rxjs';
import { environment } from '@gauzy/ui-config';
import { AppService } from '@gauzy/ui-core/core';
import { ISignInProvider, SocialLinksComponent, configuredSignInLink } from './social-links.component';

describe('SocialLinksComponent', () => {
	let component: SocialLinksComponent;
	let fixture: ComponentFixture<SocialLinksComponent>;
	let http: HttpTestingController;
	const saved = { zitadel: environment.ZITADEL_AUTH_LINK, keycloak: environment.KEYCLOAK_AUTH_LINK };

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [SocialLinksComponent],
			imports: [NbButtonModule, NbIconModule],
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
