import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UpworkStoreService, ToastrService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { SyncDataSelectionComponent } from './sync-data-selection.component';

describe('SyncDataSelectionComponent', () => {
	let component: SyncDataSelectionComponent;
	let fixture: ComponentFixture<SyncDataSelectionComponent>;

	// mocks for injected services
	const upworkStoreMock = {
		contractsSettings$: of([]),
		syncDataWithContractRelated: jasmine.createSpy('syncDataWithContractRelated').and.returnValue(of(null)),
		setSelectedEmployeeId: jasmine.createSpy('setSelectedEmployeeId')
	};

	const toastrMock = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
	const dialogRefMock = {};
	const errorHandlingMock = { handleError: jasmine.createSpy('handleError') };
	const translateServiceMock = { get: () => of('') };

	beforeEach(async () => {
		// reset spy history so each spec starts clean
		toastrMock.success.calls.reset();
		toastrMock.error.calls.reset();
		errorHandlingMock.handleError.calls.reset();

		await TestBed.configureTestingModule({
			declarations: [SyncDataSelectionComponent],
			providers: [
				{ provide: UpworkStoreService, useValue: upworkStoreMock },
				{ provide: ToastrService, useValue: toastrMock },
				{ provide: NbDialogRef, useValue: dialogRefMock },
				{ provide: ErrorHandlingService, useValue: errorHandlingMock },
				{ provide: TranslateService, useValue: translateServiceMock }
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
