import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { provideTranslateService, TranslatePipe } from '@ngx-translate/core';
import { ScreenshotCaptureAcknowledgementDialogComponent } from './screenshot-capture-acknowledgement-dialog.component';

/**
 * Issue #9872 — the admin turning screen capture on for an EEA/UK organization confirms three statements, and
 * cannot confirm fewer.
 */
describe('ScreenshotCaptureAcknowledgementDialogComponent', () => {
	function setup() {
		const dialogRef = { close: jest.fn() };

		TestBed.configureTestingModule({
			imports: [ScreenshotCaptureAcknowledgementDialogComponent],
			providers: [provideTranslateService(), { provide: NbDialogRef, useValue: dialogRef }]
		});
		TestBed.overrideComponent(ScreenshotCaptureAcknowledgementDialogComponent, {
			set: { imports: [TranslatePipe], schemas: [NO_ERRORS_SCHEMA] }
		});

		const fixture = TestBed.createComponent(ScreenshotCaptureAcknowledgementDialogComponent);
		fixture.componentInstance.organizationName = 'Acme GmbH';
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance, dialogRef };
	}

	afterEach(() => TestBed.resetTestingModule());

	const confirmButton = (fixture: ReturnType<typeof setup>['fixture']): HTMLButtonElement =>
		fixture.nativeElement.querySelector('.confirm-button');

	it('lists the three statements, each with its translation key', () => {
		const { fixture } = setup();

		const statements = Array.from(
			fixture.nativeElement.querySelectorAll('[data-statement]') as NodeListOf<HTMLElement>
		).map((element) => element.getAttribute('data-statement'));

		expect(statements).toEqual(['lawfulBasis', 'employeeNotice', 'worksCouncil']);
		expect(fixture.nativeElement.textContent).toContain('SCREEN_CAPTURE_ACKNOWLEDGEMENT_WORKS_COUNCIL');
		expect(fixture.nativeElement.textContent).toContain('Acme GmbH');
	});

	it('keeps Confirm disabled until every statement is ticked', () => {
		const { fixture, component, dialogRef } = setup();
		expect(confirmButton(fixture).disabled).toBe(true);

		component.toggle('lawfulBasis', true);
		component.toggle('employeeNotice', true);
		fixture.detectChanges();
		expect(confirmButton(fixture).disabled).toBe(true);

		component.confirm();
		expect(dialogRef.close).not.toHaveBeenCalled();

		component.toggle('worksCouncil', true);
		fixture.detectChanges();
		expect(confirmButton(fixture).disabled).toBe(false);
	});

	it('closes with the statements confirmed', () => {
		const { component, dialogRef } = setup();

		for (const statement of ['lawfulBasis', 'employeeNotice', 'worksCouncil'] as const) {
			component.toggle(statement, true);
		}
		component.confirm();

		expect(dialogRef.close).toHaveBeenCalledWith({ lawfulBasis: true, employeeNotice: true, worksCouncil: true });
	});

	it('cannot be confirmed after a statement is unticked again', () => {
		const { component, dialogRef } = setup();

		for (const statement of ['lawfulBasis', 'employeeNotice', 'worksCouncil'] as const) {
			component.toggle(statement, true);
		}
		component.toggle('employeeNotice', false);
		component.confirm();

		expect(component.complete).toBe(false);
		expect(dialogRef.close).not.toHaveBeenCalled();
	});

	it('closes with nothing when cancelled', () => {
		const { fixture, dialogRef } = setup();

		(fixture.nativeElement.querySelector('.cancel-button') as HTMLButtonElement).click();

		expect(dialogRef.close).toHaveBeenCalledWith(null);
	});
});
