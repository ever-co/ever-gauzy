import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ActionButton } from '../../../../../shared/models/action-button.model';
import { ActionButtonComponent } from './action-button.component';
describe('ActionButtonComponent', () => {
	let component: ActionButtonComponent;
	let fixture: ComponentFixture<ActionButtonComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TranslateModule.forRoot()],
			declarations: [ActionButtonComponent],
			// The template uses Nebular directives (nbButton, nbSpinner, nb-icon); ignore them here
			// so the unit test stays focused on the component, matching the sibling camshot-viewer spec.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(ActionButtonComponent);
		component = fixture.componentInstance;
		// `button` is a required @Input the template dereferences (button.loading, button.status, ...);
		// provide a default ActionButton so change detection does not read from undefined.
		fixture.componentRef.setInput('button', new ActionButton({}));
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
