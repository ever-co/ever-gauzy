import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { NbButtonModule, NbCardModule, NbCheckboxModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	IScreenshotCaptureAcknowledgement,
	SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS,
	ScreenshotCaptureAcknowledgementStatement
} from '@gauzy/contracts';

/** The translation key of each statement the admin confirms. */
const STATEMENT_KEYS: Readonly<Record<ScreenshotCaptureAcknowledgementStatement, string>> = {
	lawfulBasis: 'ORGANIZATIONS_PAGE.EDIT.SETTINGS.SCREEN_CAPTURE_ACKNOWLEDGEMENT_LAWFUL_BASIS',
	employeeNotice: 'ORGANIZATIONS_PAGE.EDIT.SETTINGS.SCREEN_CAPTURE_ACKNOWLEDGEMENT_EMPLOYEE_NOTICE',
	worksCouncil: 'ORGANIZATIONS_PAGE.EDIT.SETTINGS.SCREEN_CAPTURE_ACKNOWLEDGEMENT_WORKS_COUNCIL'
};

/**
 * Issue #9872 — asks the admin turning screen capture on for an organization in the EEA or the UK to confirm the
 * three statements the API requires: a documented lawful basis, the employees' notice (GDPR Art. 13), and the
 * works council or employee representative process. Confirm stays disabled until all three are ticked.
 *
 * Closes with the {@link IScreenshotCaptureAcknowledgement} confirmed, or with `null` when cancelled.
 */
@Component({
	selector: 'ngx-screenshot-capture-acknowledgement-dialog',
	standalone: true,
	imports: [NbCardModule, NbCheckboxModule, NbButtonModule, NbIconModule, TranslatePipe],
	templateUrl: './screenshot-capture-acknowledgement-dialog.component.html',
	styleUrls: ['./screenshot-capture-acknowledgement-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ScreenshotCaptureAcknowledgementDialogComponent {
	/** The organization the setting is for, named in the dialog. */
	@Input() organizationName?: string;

	readonly statements = SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS.map((statement) => ({
		statement,
		key: STATEMENT_KEYS[statement]
	}));

	readonly confirmed = signal<Record<ScreenshotCaptureAcknowledgementStatement, boolean>>({
		lawfulBasis: false,
		employeeNotice: false,
		worksCouncil: false
	});

	constructor(private readonly dialogRef: NbDialogRef<ScreenshotCaptureAcknowledgementDialogComponent>) {}

	/** Whether every statement is ticked. */
	get complete(): boolean {
		const confirmed = this.confirmed();
		return SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS.every((statement) => confirmed[statement] === true);
	}

	toggle(statement: ScreenshotCaptureAcknowledgementStatement, checked: boolean): void {
		this.confirmed.update((confirmed) => ({ ...confirmed, [statement]: checked === true }));
	}

	confirm(): void {
		if (!this.complete) return;
		this.dialogRef.close({ ...this.confirmed() } as IScreenshotCaptureAcknowledgement);
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
