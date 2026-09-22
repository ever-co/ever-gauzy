import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

@Component({
	selector: 'gauzy-workspace-menu',
	templateUrl: './workspace-menu.component.html',
	styleUrls: ['./workspace-menu.component.scss'],
	standalone: false
})
export class WorkspaceMenuComponent implements OnInit, OnDestroy {
	@Output()
	public close: EventEmitter<void> = new EventEmitter<void>();

	/**
	 * Whether an outside click is allowed to close this panel yet.
	 *
	 * The panel is created by the very click that opens it (the switcher in
	 * `gauzy-logo.component.html`) and `gauzyOutside` listens on `document`, so
	 * that opening click must never be the one that closes it again. Arming on a
	 * timer defers it past the end of the current task, which is strictly later
	 * than the opening click's propagation — that holds whether or not the
	 * listener is registered in time to observe the opening click at all, so the
	 * panel always survives opening and the very next outside click dismisses it.
	 */
	private armed = false;
	private armTimer: ReturnType<typeof setTimeout> | undefined;

	ngOnInit(): void {
		this.armTimer = setTimeout(() => (this.armed = true));
	}

	ngOnDestroy(): void {
		clearTimeout(this.armTimer);
	}

	public onClick() {
		this.close.emit();
	}

	/**
	 * `gauzyOutside` emits whether the click landed INSIDE this panel.
	 *
	 * This used to arm itself only on an inside click, which meant a user who
	 * opened the switcher and then clicked anything else could never dismiss it:
	 * the panel is absolutely positioned over the sidebar at z-index 1042 (see
	 * `one-column.layout.scss`), so it swallowed every click on the menu items
	 * underneath it — measured as 6 of 10 sidebar items unreachable while it was
	 * stuck open, plus the lower edge of the header's "+ Create" button and the
	 * first header combo box.
	 */
	public onClickOutside(clickedInside: boolean) {
		if (!clickedInside && this.armed) {
			this.onClick();
		}
	}
}
