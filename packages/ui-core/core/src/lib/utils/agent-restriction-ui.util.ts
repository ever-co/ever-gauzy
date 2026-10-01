import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { MonoTypeOperatorFunction, tap } from 'rxjs';
import { AGENT_EXIT_LOGOUT_FIELDS, AgentExitLogoutField } from '@gauzy/contracts';

/**
 * Issue #9873: in EEA/UK the worker must always be able to exit and log out of the desktop agent,
 * so both toggles are forced on and locked. Outside EEA/UK they are editable again.
 *
 * One exception mirrors the server: a restriction that ALREADY exists on a record that was ALREADY
 * in EEA/UK is shown as it is, so an unrelated save does not silently lift it. It stays editable so
 * the admin can lift it deliberately, and cannot be re-added once lifted (the server rejects that).
 *
 * @param keepExisting whether a field holds such a pre-existing EEA/UK restriction
 */
export function applyEEAUKFormRestrictions(
	form: FormGroup,
	isEEAOrUK: boolean,
	keepExisting: (field: AgentExitLogoutField) => boolean = () => false
): void {
	for (const field of AGENT_EXIT_LOGOUT_FIELDS) {
		const control = form.get(field);
		if (!control) continue;

		if (isEEAOrUK && keepExisting(field) && control.value === false) {
			// Not lifted yet: leave it showing, and editable so it can be lifted.
			control.enable({ emitEvent: false });
		} else if (isEEAOrUK) {
			control.setValue(true, { emitEvent: false });
			control.disable({ emitEvent: false });
		} else {
			control.enable({ emitEvent: false });
		}
	}
}

/**
 * Issue #9873: outside EEA/UK, turning either toggle off asks the admin to explicitly accept the
 * legal risk first; cancelling turns it back on. Only a change from allowed to denied asks — loading
 * an entity that is already restricted, or saving it again, is not a new restriction (the server
 * applies the same rule, see `checkAgentExitLogoutRestrictionChange`).
 *
 * @param form the settings form holding `allowAgentAppExit` / `allowLogoutFromAgentApp`
 * @param isEEAOrUK whether the entity being edited is currently in EEA/UK
 * @param getPersisted the stored value of a setting for the entity being edited
 * @param translateService used for the prompt text
 * @param untilDestroyedPipe completes the subscriptions with the component
 * @param onAck called when the admin accepts; the caller sends `acknowledgeAgentExitLogoutRestriction`
 */
export function bindAgentRestrictionListeners(
	form: FormGroup,
	isEEAOrUK: () => boolean,
	getPersisted: (field: AgentExitLogoutField) => boolean | undefined,
	translateService: TranslateService,
	untilDestroyedPipe: MonoTypeOperatorFunction<boolean>,
	onAck: () => void
): void {
	for (const field of AGENT_EXIT_LOGOUT_FIELDS) {
		const control = form.get(field);
		if (!control) continue;

		control.valueChanges
			.pipe(
				tap((value: boolean) => {
					if (value !== false || isEEAOrUK() || getPersisted(field) === false) {
						return;
					}
					const title = translateService.instant(
						'ORGANIZATIONS_PAGE.EDIT.SETTINGS.RESTRICT_AGENT_ACKNOWLEDGEMENT_TITLE'
					);
					const body = translateService.instant('ORGANIZATIONS_PAGE.EDIT.SETTINGS.RESTRICT_AGENT_ACKNOWLEDGEMENT_BODY');

					if (window.confirm(`${title}\n\n${body}`)) {
						onAck();
					} else {
						control.setValue(true, { emitEvent: false });
					}
				}),
				untilDestroyedPipe
			)
			.subscribe();
	}
}
