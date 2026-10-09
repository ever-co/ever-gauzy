// The component pulls `AlertModalComponent` from the `@gauzy/ui-core/shared` barrel,
// which transitively loads `ngx-daterangepicker-material` -> `dayjs/esm` (ESM this suite's
// `transformIgnorePatterns` does not transform, so the real barrel fails to parse under jest).
// The component only references the class as a value passed to `NbDialogService.open`, so a
// lightweight mock is all it genuinely needs.
jest.mock('@gauzy/ui-core/shared', () => ({
	AlertModalComponent: class AlertModalComponent {}
}));

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { CamshotListComponent } from './camshot-list.component';

describe('CamshotListComponent', () => {
	let component: CamshotListComponent;
	let fixture: ComponentFixture<CamshotListComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [CamshotListComponent],
			providers: [
				{ provide: NbDialogService, useValue: { open: jest.fn() } },
				{ provide: Actions, useValue: { dispatch: jest.fn() } }
			],
			// The template renders custom elements (plug-camshot-item, ngx-no-data-message) and the
			// `nbInfiniteList` directive that are not declared here; the global test-setup enables
			// errorOnUnknownElements/Properties, so suppress them.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(CamshotListComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
