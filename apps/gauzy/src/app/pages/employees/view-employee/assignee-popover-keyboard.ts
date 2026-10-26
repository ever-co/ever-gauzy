import { NbPopoverDirective } from '@nebular/theme';

/**
 * Keyboard access to the assignee popovers of the employee and team pages.
 *
 * A popover opened on hover lives in an overlay at the end of the page, out
 * of the tab order, so a keyboard user could never reach the links in it. The
 * "+N" chip therefore opens its list on Enter or Space and moves focus into
 * it; Tab walks the people, and Escape — or tabbing past the last one — closes
 * the list (Escape also returns focus to the chip). Each avatar is itself a
 * link to the person's profile, so its card only needs to show on focus. A
 * click or tap on the chip opens its list too, for touch screens, which have
 * no hover.
 */
export class AssigneePopoverKeyboard {
	private _list: { popover: NbPopoverDirective; trigger: HTMLElement } | null = null;

	/** Enter / Space on the "+N" chip: open its list and move focus into it. */
	openList(event: Event, popover: NbPopoverDirective): void {
		event.preventDefault();
		this._list = { popover, trigger: event.currentTarget as HTMLElement };
		popover.show();
		// The list renders on the next tick, in the overlay.
		setTimeout(() => (document.querySelector('.person-popover .people-list-row') as HTMLElement | null)?.focus());
	}

	/** Leaving the chip closes its list — unless focus went into that list. */
	onTriggerBlur(event: FocusEvent, popover: NbPopoverDirective): void {
		if (AssigneePopoverKeyboard.isInList(event.relatedTarget)) return;
		popover.hide();
	}

	/** Focus leaving the list (Tab past its last person) closes it. */
	onListFocusOut(event: FocusEvent): void {
		if (AssigneePopoverKeyboard.isInList(event.relatedTarget)) return;
		this.close(false);
	}

	/** Escape closes the list and returns focus to its chip. */
	onListEscape(): void {
		this.close(true);
	}

	private close(refocus: boolean): void {
		const list = this._list;
		this._list = null;
		list?.popover.hide();
		if (refocus) list?.trigger.focus();
	}

	private static isInList(target: EventTarget | null): boolean {
		return target instanceof HTMLElement && !!target.closest('.people-list');
	}
}
