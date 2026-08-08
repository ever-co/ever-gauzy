import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Params } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_SAVED_VIEW_NAME_MAX, DOCS_SAVED_VIEWS_LIMIT } from '../../docs.constants';
import { IDocsSavedView } from '../../models/docs-saved-view.model';
import { DocsSavedViewsService } from '../../services/docs-saved-views.service';

/**
 * Saved filter views control in the filter bar (`01-ux-spec.md` §5, M5).
 *
 * Device-local only: the service writes `localStorage` and nothing here talks to
 * the API. The component owns just the popover UI — save current view, apply,
 * rename, delete — and emits the query-param patch the browse page merges into
 * the URL, keeping §5.1's "URL is the single source of truth" contract intact.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-saved-views',
	templateUrl: './saved-views.component.html',
	styleUrls: ['./saved-views.component.scss'],
	standalone: false
})
export class SavedViewsComponent extends TranslationBaseComponent implements OnInit {
	/** Current URL query params — what "Save current view" captures. */
	@Input() params: Params = {};

	/** Emits the merge patch that applies a view (see `toApplyPatch`). */
	@Output() applyView = new EventEmitter<Params>();

	public views: IDocsSavedView[] = [];
	public open = false;
	public draftName = '';
	/** Id of the row currently being renamed inline (null = none). */
	public renamingId: string | null = null;
	public renameDraft = '';

	public readonly nameMaxLength = DOCS_SAVED_VIEW_NAME_MAX;
	public readonly limit = DOCS_SAVED_VIEWS_LIMIT;

	constructor(
		public readonly translateService: TranslateService,
		private readonly savedViews: DocsSavedViewsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.savedViews.views$.pipe(untilDestroyed(this)).subscribe((views) => (this.views = views));
		this.savedViews.refresh();
	}

	toggle(): void {
		this.open = !this.open;
		if (this.open) {
			this.savedViews.refresh();
			this.draftName = '';
			this.cancelRename();
		}
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
