import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UpworkComponent } from './upwork.component';
import { ActivatedRoute } from '@angular/router';
import { Store, UpworkStoreService } from '@gauzy/ui-core/core';
import { IntegrationUpworkUiModule } from '../../integration-upwork-ui.module';

describe('UpworkComponent', () => {
	let component: UpworkComponent;
	let fixture: ComponentFixture<UpworkComponent>;

	// minimal mocks for injected services
	const activatedRouteMock = { params: of({}) };
	const upworkStoreMock = {
		getConfig: jest.fn().mockReturnValue(of({}))
	};
	const storeMock = {
		selectedOrganization$: of(null)
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope; the
			// mocks below still replace the services it injects.
			imports: [IntegrationUpworkUiModule],
			// Router is NOT mocked either: the template's routerLink / routerLinkActive need a real router (its
			// events and URL trees), which the root defaults provide; nothing here asserts a navigation.
			// TranslateService is NOT mocked: the root jest.angular-defaults.ts provides a real, loader-less one
			// (it returns keys). The partial mock that sat here lacked `instant` and the change streams the
			// translate pipe subscribes to, so the template could not render.
			providers: [
				{ provide: ActivatedRoute, useValue: activatedRouteMock },
				{ provide: UpworkStoreService, useValue: upworkStoreMock },
				{ provide: Store, useValue: storeMock }
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(UpworkComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
