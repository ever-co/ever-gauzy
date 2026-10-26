import { NbPopoverDirective } from '@nebular/theme';

/** Every member hover card's popover carries this class (`nbPopoverClass`). */
const CARD_SELECTOR = '.person-popover';

/** Card ids handed out so far; each trigger gets its own (see {@link personCardId}). */
let cardCount = 0;

/**
 * A unique id for the card of one trigger. The popover keeps its overlay to itself,
 * so a trigger finds its own card by this id — set on the card, carried in the
 * popover context — rather than by the first card in the document, which may be
 * another member's card still open under the pointer. Per trigger, not per person:
 * the same person can be listed under several expanded teams at once.
 */
export function personCardId(): string {
	return `team-person-card-${++cardCount}`;
}

/**
 * Keyboard access to the Teams dashboard's member hover cards.
 *
 * A card opened on hover lives in an overlay at the end of the page, out of the
 * tab order, so a keyboard user could never reach its email or profile links.
 * The name that triggers it shows the card on focus, as the team page's
 * assignees do; Arrow Down then moves focus into the card, which stays open
 * while focus is inside. Escape — or tabbing out of the card past either end —
 * closes it and returns focus to the name. Tab on the name itself still moves
 * on to the next control, so the cards never trap keyboard users.
 *
 * Modelled on the team page's `AssigneePopoverKeyboard`.
 */
export class PersonCardKeyboard {
	private _open: { popover: NbPopoverDirective; trigger: HTMLElement } | null = null;

	/** Set while focus is handed back to a name, so that refocus does not reopen its card. */
	private _returningFocus = false;

	/** Focus on a name shows its card, as the team page's assignees do. */
	onTriggerFocus(popover: NbPopoverDirective): void {
		if (this._returningFocus) return;
		popover.show();
	}

	/**
	 * Arrow Down on a name: open its card and move focus to that card's first link
	 * (the email, else the profile) — found by the card's own id, `cardId`.
	 */
	onTriggerKeydown(event: KeyboardEvent, popover: NbPopoverDirective, cardId: string): void {
		if (event.key !== 'ArrowDown') return;
		event.preventDefault();
		this._open = { popover, trigger: event.currentTarget as HTMLElement };
		popover.show();
		// The card renders on the next tick, in the overlay.
		setTimeout(() => {
			const card = document.getElementById(cardId);
			(card?.querySelector('a[href]') as HTMLElement | null)?.focus();
		});
	}

	/** Leaving the name closes its card — unless focus went into that card. */
	onTriggerBlur(event: FocusEvent, popover: NbPopoverDirective): void {
		if (PersonCardKeyboard.isInCard(event.relatedTarget)) return;
		popover.hide();
	}

	/** Focus leaving the card (Tab past its last link, or Shift+Tab before its first) closes it. */
	onCardFocusOut(event: FocusEvent): void {
		if (PersonCardKeyboard.isInCard(event.relatedTarget)) return;
		this.close();
	}

	/** Escape closes the card and returns focus to its name. */
	onCardEscape(): void {
		this.close();
	}

	private close(): void {
		const open = this._open;
		this._open = null;
		open?.popover.hide();
		this._returningFocus = true;
		open?.trigger.focus();
		this._returningFocus = false;
	}

	private static isInCard(target: EventTarget | null): boolean {
		return target instanceof HTMLElement && !!target.closest(CARD_SELECTOR);
	}
}
