import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CamshotItemComponent } from './camshot-item.component';
describe('CamshotItemComponent', () => {
	let component: CamshotItemComponent;
	let fixture: ComponentFixture<CamshotItemComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [CamshotItemComponent],
			// The template renders custom elements (nb-icon, plug-action-button-group) and the
			// `fileSize` pipe that are not declared here; the global test-setup enables
			// errorOnUnknownElements/Properties, so suppress them.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(CamshotItemComponent);
		component = fixture.componentInstance;
		// The template dereferences `camshot` (e.g. [class.deleted]="camshot.isDeleted"), so the
		// required input must be set before change detection runs.
		fixture.componentRef.setInput('camshot', { id: '1', title: 'Test camshot' });
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
