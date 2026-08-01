import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	OnDestroy,
	Renderer2,
	TemplateRef,
	inject,
	input
} from '@angular/core';
import { ComponentEnum } from '@gauzy/ui-core/common';

@Component({
	selector: 'ngx-gauzy-button-action',
	templateUrl: './gauzy-button-action.component.html',
	styleUrls: ['./gauzy-button-action.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class GauzyButtonActionComponent implements AfterViewInit, OnDestroy {
	/** Marks the block holding these buttons as the page header's action slot. */
	private static readonly PAGE_HEADER_ACTIONS_CLASS = 'ga-page-header-actions';

	/** Whether the action buttons are disabled / hidden. */
	readonly isDisable = input<boolean>(true);

	/** Whether the layout selector toggle is shown. */
	readonly hasLayoutSelector = input<boolean>(true);

	/** The component name passed to the layout selector. */
	readonly componentName = input<ComponentEnum>();

	/** Template reference for the primary action button. */
	readonly buttonTemplate = input<TemplateRef<unknown>>();

	/** Template reference for the visible-state button. */
	readonly buttonTemplateVisible = input<TemplateRef<unknown>>();

	private readonly elementRef = inject(ElementRef);
	private readonly renderer = inject(Renderer2);

	/** Element marked as the action slot, so the mark can be removed on destroy. */
	private actionSlot: HTMLElement | null = null;

	ngAfterViewInit(): void {
		this.markPageHeaderActions();
	}

	ngOnDestroy(): void {
		if (this.actionSlot) {
			this.renderer.removeClass(this.actionSlot, GauzyButtonActionComponent.PAGE_HEADER_ACTIONS_CLASS);
			this.actionSlot = null;
		}
	}

	/**
	 * Marks the card-header block these buttons sit in, so the header can lay it
	 * out on the page title's line rather than on a row of its own (see
	 * `.ga-page-header` in `ui-core/static/styles/_overrides.scss`; the title side
	 * is marked by `HeaderTitleComponent`, which also decides whether the header
	 * takes part at all).
	 *
	 * The mark is applied from here, and not by the header title, because several
	 * pages wrap this block in an `@if` — it has to come back with the block.
	 * Outside a card header (a tab strip, a card body) there is nothing to mark.
	 */
	private markPageHeaderActions(): void {
		const host: HTMLElement = this.elementRef.nativeElement;
		const header: HTMLElement | null = host.closest<HTMLElement>('nb-card-header');
		if (!header) {
			return;
		}

		// `header` is an ancestor of `host`, so the walk always terminates.
		let slot: HTMLElement | null = host;
		while (slot && slot.parentElement !== header) {
			slot = slot.parentElement;
		}
		if (!slot) {
			return;
		}

		this.renderer.addClass(slot, GauzyButtonActionComponent.PAGE_HEADER_ACTIONS_CLASS);
		this.actionSlot = slot;
	}
}
