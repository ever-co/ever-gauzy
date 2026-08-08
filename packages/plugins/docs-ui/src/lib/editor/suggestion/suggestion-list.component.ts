import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { NbIconModule } from '@nebular/theme';

/** One row of any suggestion popup (slash menu, mentions, emoji share this shape). */
export interface ISuggestionItem<T = unknown> {
	id: string;
	/** Already-translated display label. */
	label: string;
	/** Eva icon name (default pack) — or a FontAwesome class when `pack: 'fa'`. */
	icon?: string;
	pack?: 'eva' | 'fa';
	/** Literal glyph rendered instead of an icon (emoji). */
	glyph?: string;
	/** Already-translated group header (rows are grouped in given order). */
	group?: string;
	hint?: string;
	disabled?: boolean;
	/** Payload forwarded to the suggestion `command`. */
	data: T;
}

/**
 * Generic listbox rendered inside the shared suggestion overlay (spec 05 §6.4).
 * Keyboard state is driven imperatively by `SuggestionHostService` (the editor
 * keeps focus; `aria-activedescendant` points here).
 */
@Component({
	selector: 'gz-suggestion-list',
	standalone: true,
	imports: [CommonModule, NbIconModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="gz-suggestion-list" role="listbox" [attr.aria-label]="ariaLabel">
			<ng-container *ngFor="let item of items; let i = index">
				<div class="gz-suggestion-group" *ngIf="item.group && isGroupStart(i)" role="presentation">
					{{ item.group }}
				</div>
				<button
					type="button"
					class="gz-suggestion-item"
					role="option"
					[id]="'gz-suggestion-option-' + i"
					[class.active]="i === activeIndex"
					[attr.aria-selected]="i === activeIndex"
					[disabled]="item.disabled"
					(mousedown)="$event.preventDefault()"
					(mouseenter)="setActive(i)"
					(click)="select(i)"
				>
					<span class="gz-suggestion-glyph" *ngIf="item.glyph">{{ item.glyph }}</span>
					<nb-icon
						*ngIf="!item.glyph && item.icon && item.pack !== 'fa'"
						[icon]="item.icon"
						class="gz-suggestion-icon"
					></nb-icon>
					<i *ngIf="!item.glyph && item.icon && item.pack === 'fa'" class="{{ item.icon }} gz-suggestion-icon"></i>
					<span class="gz-suggestion-label">{{ item.label }}</span>
					<span class="gz-suggestion-hint" *ngIf="item.hint">{{ item.hint }}</span>
				</button>
			</ng-container>
			<div class="gz-suggestion-empty" *ngIf="!items.length">{{ emptyLabel }}</div>
		</div>
	`,
	styles: [
		`
			.gz-suggestion-list {
				min-width: 14rem;
				max-width: 20rem;
				max-height: 19rem;
				overflow-y: auto;
				padding: 0.25rem;
				border-radius: var(--border-radius);
				border: 1px solid var(--border-basic-color-3);
				background: var(--background-basic-color-1);
				box-shadow: var(--shadow);
			}
			.gz-suggestion-group {
				padding: 0.375rem 0.5rem 0.125rem;
				font-size: 0.6875rem;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.04em;
				color: var(--text-hint-color);
			}
			.gz-suggestion-item {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				width: 100%;
				border: none;
				background: transparent;
				border-radius: 0.25rem;
				padding: 0.375rem 0.5rem;
				cursor: pointer;
				text-align: left;
				color: var(--text-basic-color);
				font-size: 0.875rem;
			}
			.gz-suggestion-item.active {
				background: var(--color-primary-transparent-100);
			}
			.gz-suggestion-item:disabled {
				opacity: 0.4;
				cursor: default;
			}
			.gz-suggestion-icon {
				font-size: 1rem;
				width: 1.25rem;
				text-align: center;
				color: var(--text-hint-color);
			}
			.gz-suggestion-glyph {
				width: 1.25rem;
				text-align: center;
			}
			.gz-suggestion-label {
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.gz-suggestion-hint {
				font-size: 0.75rem;
				color: var(--text-hint-color);
			}
			.gz-suggestion-empty {
				padding: 0.5rem;
				font-size: 0.875rem;
				color: var(--text-hint-color);
			}
		`
	]
})
export class SuggestionListComponent {
	private readonly cdr = inject(ChangeDetectorRef);

	public items: ISuggestionItem[] = [];
	public activeIndex = 0;
	public ariaLabel = '';
	public emptyLabel = '';
	/** Set by the host; invoked with the chosen item. */
	public onSelect: (item: ISuggestionItem) => void = () => void 0;

	setItems(items: ISuggestionItem[], emptyLabel: string, ariaLabel: string): void {
		this.items = items;
		this.emptyLabel = emptyLabel;
		this.ariaLabel = ariaLabel;
		this.activeIndex = Math.min(this.activeIndex, Math.max(0, items.length - 1));
		this.cdr.markForCheck();
	}

	isGroupStart(index: number): boolean {
		return index === 0 || this.items[index - 1]?.group !== this.items[index]?.group;
	}

	setActive(index: number): void {
		this.activeIndex = index;
		this.cdr.markForCheck();
	}

	move(delta: number): void {
		if (!this.items.length) return;
		this.activeIndex = (this.activeIndex + delta + this.items.length) % this.items.length;
		this.cdr.markForCheck();
		this.scrollActiveIntoView();
	}

	select(index = this.activeIndex): void {
		const item = this.items[index];
		if (item && !item.disabled) this.onSelect(item);
	}

	get activeDescendantId(): string | null {
		return this.items.length ? `gz-suggestion-option-${this.activeIndex}` : null;
	}

	private scrollActiveIntoView(): void {
		requestAnimationFrame(() => {
			document.getElementById(`gz-suggestion-option-${this.activeIndex}`)?.scrollIntoView({ block: 'nearest' });
		});
	}
}
