import { FormControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs';

/**
 * Enforces or clears disabled state on allowAgentAppExit / allowLogoutFromAgentApp for EEA/UK region compliance.
 */
export function applyEEAUKFormRestrictions(form: FormGroup, isEEAOrUK: boolean): void {
	const exitControl = form.get('allowAgentAppExit');
	const logoutControl = form.get('allowLogoutFromAgentApp');

	if (isEEAOrUK) {
		exitControl?.setValue(true, { emitEvent: false });
		exitControl?.disable({ emitEvent: false });
		logoutControl?.setValue(true, { emitEvent: false });
		logoutControl?.disable({ emitEvent: false });
	} else {
		exitControl?.enable({ emitEvent: false });
		logoutControl?.enable({ emitEvent: false });
	}
}

/**
 * Binds valueChanges listeners for allowAgentAppExit and allowLogoutFromAgentApp to prompt admin acknowledgement when restricting.
 */
export function bindAgentRestrictionListeners(
	form: FormGroup,
	isEEAOrUK: () => boolean,
	translateService: TranslateService,
	untilDestroyedPipe: any,
	onAck: () => void
): void {
	const fields = ['allowAgentAppExit', 'allowLogoutFromAgentApp'] as const;

	fields.forEach((field) => {
		const control = <FormControl>form.get(field);
		if (!control) return;

		control.valueChanges
			.pipe(
				tap((value: boolean) => {
					if (value === false && !isEEAOrUK()) {
						const title = translateService.instant('ORGANIZATIONS_PAGE.EDIT.SETTINGS.RESTRICT_AGENT_ACKNOWLEDGEMENT_TITLE');
						const body = translateService.instant('ORGANIZATIONS_PAGE.EDIT.SETTINGS.RESTRICT_AGENT_ACKNOWLEDGEMENT_BODY');
						const confirmed = window.confirm(`${title}\n\n${body}`);

						if (confirmed) {
							onAck();
						} else {
							control.setValue(true, { emitEvent: false });
						}
					}
				}),
				untilDestroyedPipe
			)
			.subscribe();
	});
}
