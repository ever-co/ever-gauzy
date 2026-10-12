import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Injectable, Injector, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { SuggestionProps } from '@tiptap/suggestion';
import { ISuggestionItem, SuggestionListComponent } from './suggestion-list.component';

/**
 * Shared CDK-overlay popup host for every trigger-character popup — slash menu,
 * employee/document mentions and emoji share one implementation with three
 * configurations (spec 05 §6.4). Positioning uses `@floating-ui/dom`
 * (`bottom-start`, flip + shift) against the suggestion `clientRect`.
 */
@Injectable()
export class SuggestionHostService {
	private readonly overlay = inject(Overlay);
	private readonly injector = inject(Injector);
	private readonly translate = inject(TranslateService);

	private overlayRef: OverlayRef | null = null;
	private list: SuggestionListComponent | null = null;
	private clientRect: (() => DOMRect | null) | null = null;

	/** True while any suggestion popup is open (bubble menus suppress themselves). */
	get isOpen(): boolean {
		return !!this.overlayRef;
	}

	/** Id for `aria-activedescendant` on the editor host. */
	get activeDescendantId(): string | null {
		return this.list?.activeDescendantId ?? null;
	}

	open(props: SuggestionProps<ISuggestionItem>, ariaLabelKey: string): void {
		this.close();
		this.overlayRef = this.overlay.create({
			positionStrategy: this.overlay.position().global(),
			scrollStrategy: this.overlay.scrollStrategies.reposition(),
			panelClass: 'gz-suggestion-overlay'
		});
		const portal = new ComponentPortal(SuggestionListComponent, null, this.injector);
		const componentRef = this.overlayRef.attach(portal);
		this.list = componentRef.instance;
		this.list.onSelect = (item) => props.command(item);
		this.update(props, ariaLabelKey);
	}

	update(props: SuggestionProps<ISuggestionItem>, ariaLabelKey: string): void {
		if (!this.list) return;
		this.list.onSelect = (item) => props.command(item);
		this.list.setItems(
			props.items ?? [],
			this.translate.instant('DOCS.EDITOR.SLASH.NO_RESULTS'),
			this.translate.instant(ariaLabelKey)
		);
		this.clientRect = (props.clientRect as () => DOMRect | null) ?? null;
		this.reposition();
	}

	/** Forwarded suggestion keydown: ↑/↓ move, Enter/Tab select, Escape closes. */
	onKeyDown(event: KeyboardEvent): boolean {
		if (!this.list) return false;
		switch (event.key) {
			case 'ArrowDown':
				this.list.move(1);
				return true;
			case 'ArrowUp':
				this.list.move(-1);
				return true;
			case 'Enter':
			case 'Tab':
				this.list.select();
				return true;
			case 'Escape':
				this.close();
				return true;
			default:
				return false;
		}
	}

	close(): void {
		this.overlayRef?.dispose();
		this.overlayRef = null;
		this.list = null;
		this.clientRect = null;
	}

	private reposition(): void {
		const overlayRef = this.overlayRef;
		const rect = this.clientRect?.();
		if (!overlayRef || !rect) return;
		const virtualElement = { getBoundingClientRect: () => rect };
		const panel = overlayRef.overlayElement;
		void computePosition(virtualElement, panel, {
			placement: 'bottom-start',
			middleware: [offset(6), flip(), shift({ padding: 8 })]
		}).then(({ x, y }) => {
			panel.style.position = 'fixed';
			panel.style.left = `${x}px`;
			panel.style.top = `${y}px`;
		});
	}
}
