import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NbDialogRef } from '@nebular/theme';
import { UpworkStoreService, ToastrService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { SyncDataSelectionComponent } from './sync-data-selection.component';
import { IntegrationUpworkUiModule } from '../../integration-upwork-ui.module';

describe('SyncDataSelectionComponent', () => {
	let component: SyncDataSelectionComponent;
	let fixture: ComponentFixture<SyncDataSelectionComponent>;

	// mocks for injected services
	const upworkStoreMock = {
		contractsSettings$: of([]),
		syncDataWithContractRelated: jest.fn().mockReturnValue(of(null)),
		setSelectedEmployeeId: jest.fn()
	};

	const toastrMock = { success: jest.fn(), error: jest.fn() };
	const dialogRefMock = {};
	const errorHandlingMock = { handleError: jest.fn() };

	beforeEach(async () => {
		// reset spy history so each spec starts clean
		toastrMock.success.mockClear();
		toastrMock.error.mockClear();
		errorHandlingMock.handleError.mockClear();

		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope; the
			// mocks below still replace the services it injects.
			imports: [IntegrationUpworkUiModule],
			// TranslateService is NOT mocked: the root jest.angular-defaults.ts provides a real, loader-less one
			// (it returns keys). The partial mock that sat here lacked `instant` and the change streams the
			// translate pipe subscribes to, so the template could not render.
			providers: [
				{ provide: UpworkStoreService, useValue: upworkStoreMock },
				{ provide: ToastrService, useValue: toastrMock },
				{ provide: NbDialogRef, useValue: dialogRefMock },
				{ provide: ErrorHandlingService, useValue: errorHandlingMock }
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(SyncDataSelectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
