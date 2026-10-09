import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Params } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_SAVED_VIEW_NAME_MAX, DOCS_SAVED_VIEWS_LIMIT } from '../../docs.constants';
import { IDocsSavedView } from '../../models/docs-saved-view.model';
import { DocsSavedViewsService } from '../../services/docs-saved-views.service';

/** Ideal panel width; it narrows on a viewport that cannot hold it. */
const PANEL_WIDTH_PX = 288;
/** Breathing room kept between the panel and every viewport edge. */
const VIEWPORT_MARGIN_PX = 8;
/** Gap between the trigger and the panel it opens. */
const TRIGGER_GAP_PX = 6;
/** Below this much room underneath the trigger, the panel opens upwards. */
const MIN_PANEL_HEIGHT_PX = 200;

/**
 * Saved filter views control in the filter bar (`01-ux-spec.md` §5, M5).
 *
 * Device-local only: the service writes `localStorage` and nothing here talks to
 * the API. The component owns just the popover UI — save current view, apply,
 * rename, delete — and emits the query-param patch the browse page merges into
 * the URL, keeping §5.1's "URL is the single source of truth" contract intact.
 *
 * The panel is `position: fixed` and measured off the trigger on open (and on
 * any scroll or resize while open), so it takes part in no ancestor's overflow,
 * stays clamped into the viewport and flips above the trigger when the room
 * below runs out.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-saved-views',
	templateUrl: './saved-views.component.html',
	styleUrls: ['./saved-views.component.scss'],
	standalone: false
})
export class SavedViewsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	/** Current URL query params — what "Save current view" captures. */
	@Input() params: Params = {};

	/** Emits the merge patch that applies a view (see `toApplyPatch`). */
	@Output() applyView = new EventEmitter<Params>();

	@ViewChild('trigger', { read: ElementRef }) private triggerRef?: ElementRef<HTMLElement>;

	public views: IDocsSavedView[] = [];
	public open = false;
	public draftName = '';
	/** Id of the row currently being renamed inline (null = none). */
	public renamingId: string | null = null;
	public renameDraft = '';

	/** Resolved `position: fixed` box for the panel. */
	public panelStyle: Record<string, string> = {};

	public readonly nameMaxLength = DOCS_SAVED_VIEW_NAME_MAX;
	public readonly limit = DOCS_SAVED_VIEWS_LIMIT;

	/** Registered in the capture phase: scroll does not bubble to `window`. */
	private readonly onAnyScroll = () => this.reposition();

	constructor(
		public readonly translateService: TranslateService,
		private readonly savedViews: DocsSavedViewsService,
		private readonly host: ElementRef<HTMLElement>
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.savedViews.views$.pipe(untilDestroyed(this)).subscribe((views) => (this.views = views));
		this.savedViews.refresh();
		if (typeof window !== 'undefined') {
			window.addEventListener('scroll', this.onAnyScroll, true);
		}
	}

	ngOnDestroy(): void {
		if (typeof window !== 'undefined') {
			window.removeEventListener('scroll', this.onAnyScroll, true);
		}
	}

	toggle(): void {
		this.open = !this.open;
		if (this.open) {
			this.savedViews.refresh();
			this.draftName = '';
			this.cancelRename();
			this.reposition();
		}
	}

	/** An outside click closes the panel. */
	@HostListener('document:click', ['$event'])
	onDocumentClick(event: Event): void {
		if (!this.open) return;
		const target = event.target as Node | null;
		if (target && this.host.nativeElement.contains(target)) return;
		this.open = false;
	}

	@HostListener('document:keydown.escape')
	onEscape(): void {
		if (!this.open) return;
		this.open = false;
		this.triggerRef?.nativeElement?.focus();
	}

	@HostListener('window:resize')
	reposition(): void {
		const trigger = this.triggerRef?.nativeElement;
		if (!this.open || !trigger || typeof window === 'undefined') return;

		const rect = trigger.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		const width = Math.min(PANEL_WIDTH_PX, viewportWidth - VIEWPORT_MARGIN_PX * 2);
		const left = Math.min(
			Math.max(VIEWPORT_MARGIN_PX, rect.right - width),
			viewportWidth - width - VIEWPORT_MARGIN_PX
		);

		const roomBelow = viewportHeight - rect.bottom - TRIGGER_GAP_PX - VIEWPORT_MARGIN_PX;
		const roomAbove = rect.top - TRIGGER_GAP_PX - VIEWPORT_MARGIN_PX;
		const flipUp = roomBelow < MIN_PANEL_HEIGHT_PX && roomAbove > roomBelow;
		// The room on the side we actually chose. `MIN_PANEL_HEIGHT_PX` is the FLIP
		// threshold, not a layout minimum: using it as a floor for `max-height` made the
		// panel taller than the viewport when neither side had 200px (short window, or a
		// trigger near the middle) — the panel scrolls internally instead.
		const room = Math.max(0, flipUp ? roomAbove : roomBelow);

		this.panelStyle = {
			width: `${width}px`,
			left: `${left}px`,
			...(flipUp
				? { bottom: `${viewportHeight - rect.top + TRIGGER_GAP_PX}px` }
				: { top: `${rect.bottom + TRIGGER_GAP_PX}px` }),
			maxHeight: `${room}px`
		};
	}

	get atLimit(): boolean {
		return this.views.length >= this.limit;
	}

	/** True when the given view describes exactly the filters currently in the URL. */
	isActive(view: IDocsSavedView): boolean {
		return this.savedViews.matches(view, this.params ?? {});
	}

	/** Label for the trigger button: the matching view's name, or the generic label. */
	get activeLabel(): string {
		const active = this.views.find((view) => this.isActive(view));
		return active?.name ?? this.getTranslation('DOCS.SAVED_VIEWS.LABEL');
	}

	// ─── Mutations ───────────────────────────────────────────────

	save(): void {
		const name = this.draftName.trim();
		if (!name) return;
		// Saving under an existing name overwrites it — see the service doc.
		const saved = this.savedViews.save(name, this.params ?? {});
		if (saved) this.draftName = '';
	}

	apply(view: IDocsSavedView): void {
		this.applyView.emit(this.savedViews.toApplyPatch(view));
		this.open = false;
	}

	startRename(view: IDocsSavedView, event: Event): void {
		event.stopPropagation();
		this.renamingId = view.id;
		this.renameDraft = view.name;
	}

	commitRename(view: IDocsSavedView): void {
		const name = this.renameDraft.trim();
		if (name && name !== view.name) this.savedViews.rename(view.id, name);
		this.cancelRename();
	}

	cancelRename(): void {
		this.renamingId = null;
		this.renameDraft = '';
	}

	remove(view: IDocsSavedView, event: Event): void {
		event.stopPropagation();
		this.savedViews.remove(view.id);
		if (this.renamingId === view.id) this.cancelRename();
	}

	trackView(_: number, view: IDocsSavedView): string {
		return view.id;
	}
}
