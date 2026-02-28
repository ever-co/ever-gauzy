import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UpworkComponent } from './upwork.component';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, UpworkStoreService } from '@gauzy/ui-core/core';
import { TranslateService } from '@ngx-translate/core';

describe('UpworkComponent', () => {
	let component: UpworkComponent;
	let fixture: ComponentFixture<UpworkComponent>;

	// minimal mocks for injected services
	const routerMock = { navigate: jasmine.createSpy('navigate') };
	const activatedRouteMock = { params: of({}) };
	const upworkStoreMock = {
		getConfig: jasmine.createSpy('getConfig').and.returnValue(of({}))
	};
	const storeMock = {
		selectedOrganization$: of(null)
	};
	const translateServiceMock = {
		get: () => of(''),
		onLangChange: of({})
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [UpworkComponent],
			providers: [
				{ provide: Router, useValue: routerMock },
				{ provide: ActivatedRoute, useValue: activatedRouteMock },
				{ provide: UpworkStoreService, useValue: upworkStoreMock },
				{ provide: Store, useValue: storeMock },
				{ provide: TranslateService, useValue: translateServiceMock }
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
