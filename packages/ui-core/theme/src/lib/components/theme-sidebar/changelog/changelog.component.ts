import { Component, OnDestroy, OnInit } from '@angular/core';
import { IChangelog } from '@gauzy/contracts';
import { NbSidebarService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { asyncScheduler, merge, Observable } from 'rxjs';
import { filter, observeOn, take, tap } from 'rxjs/operators';
import { ChangelogService } from '@gauzy/ui-core/core';

/** Tag of the Nebular sidebar this component is rendered into. */
export const CHANGELOG_SIDEBAR_TAG = 'changelog_sidebar';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-changelog',
	templateUrl: './changelog.component.html',
	styleUrls: ['./changelog.component.scss'],
	standalone: false
})
export class ChangelogComponent implements OnInit, OnDestroy {
	items$: Observable<IChangelog[]> = this._changelogService.changelogs$;

	/** Whether the panel is on screen, i.e. whether an outside click has anything to dismiss. */
	private state: boolean;

	constructor(
		private readonly _changelogService: ChangelogService,
		private readonly _sidebarService: NbSidebarService
	) {}

	ngOnInit() {
		this._changelogService.getAll({ isFeature: 0 }).pipe(untilDestroyed(this)).subscribe();

		this.syncState();
		merge(
			this._sidebarService.onToggle(),
			this._sidebarService.onExpand(),
			this._sidebarService.onCollapse(),
			this._sidebarService.onCompact()
		)
			.pipe(
				filter(({ tag }) => tag === CHANGELOG_SIDEBAR_TAG),
				// DO NOT make this synchronous. The header action calls the sidebar service from a
				// click handler, and `OutsideDirective` listens on `document:click` WITHOUT capture, so
				// it runs later in that same dispatch. If `state` were already true by then, the panel
				// would collapse on the very click that opened it. Same reasoning as the Quick Settings
				// panel next door, which hit exactly that.
				observeOn(asyncScheduler),
				untilDestroyed(this)
			)
			.subscribe(() => this.syncState());
	}

	/**
	 * Read the panel's current state. `take(1)` is what makes this safe to call repeatedly:
	 * `getSidebarState()` returns a ReplaySubject that receives exactly one value.
	 */
	private syncState(): void {
		this._sidebarService
			.getSidebarState(CHANGELOG_SIDEBAR_TAG)
			.pipe(
				take(1),
				tap((state) => (this.state = state === 'expanded')),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Collapses rather than toggles: this is only ever called to close the panel,
	 * from the X button and from a click outside it.
	 */
	public closeSidebar() {
		this._sidebarService.collapse(CHANGELOG_SIDEBAR_TAG);
	}

	/** `gauzyOutside` emits whether the click landed INSIDE the host, not outside it. */
	public onClickOutside(clickedInside: boolean) {
		if (!clickedInside && this.state) {
			this.closeSidebar();
		}
	}

	ngOnDestroy(): void {}
}
