import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, Input, ViewChild } from '@angular/core';
import { NbPopoverDirective, NbPosition } from '@nebular/theme';
import { EVER_APPS, IEverApp, isCurrentEverApp } from '@gauzy/ui-core/common';
import { ElectronService } from '@gauzy/ui-core/core';

let nextPanelNumber = 0;

function getNextRowIndex(key: string, focusedIndex: number, rowCount: number): number | null {
	const lastIndex = rowCount - 1;
	switch (key) {
		case 'ArrowDown':
			if (focusedIndex >= lastIndex) {
				return 0;
			}
			return focusedIndex + 1;
		case 'ArrowUp':
			if (focusedIndex <= 0) {
				return lastIndex;
			}
			return focusedIndex - 1;
		case 'Home':
			return 0;
		case 'End':
			return lastIndex;
		default:
			return null;
	}
}

@Component({
	selector: 'gauzy-app-switcher',
	templateUrl: './app-switcher.component.html',
	styleUrls: ['./app-switcher.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class AppSwitcherComponent {
	private readonly _electronService = inject(ElectronService);
	private readonly _document = inject(DOCUMENT);

	@Input() compact = false;

	@ViewChild('trigger') triggerRef?: ElementRef<HTMLButtonElement>;
	@ViewChild('appsPopover') appsPopover?: NbPopoverDirective;

	readonly apps = EVER_APPS;
	readonly panelId: string;

	isPanelShown = false;

	constructor() {
		nextPanelNumber += 1;
		this.panelId = `gauzy-app-switcher-panel-${nextPanelNumber}`;
	}

	get placement(): NbPosition {
		if (this.compact) {
			return NbPosition.END_TOP;
		}
		return NbPosition.BOTTOM_START;
	}

	isCurrent(app: IEverApp): boolean {
		return isCurrentEverApp(app);
	}

	onPanelShowStateChange(isShown: boolean): void {
		this.isPanelShown = isShown;
		if (isShown) {
			setTimeout(() => this.focusFirstLink());
		}
	}

	onAppPick(event: MouseEvent, app: IEverApp): void {
		// Inside the desktop apps a plain link would load the other app into the Gauzy window itself.
		const shell = this._electronService.shell;
		const canOpenInSystemBrowser = typeof shell?.openExternal === 'function';
		this.appsPopover?.hide();
		if (!canOpenInSystemBrowser) {
			return;
		}
		event.preventDefault();
		shell.openExternal(app.url);
	}

	onPanelKeydown(event: KeyboardEvent): void {
		const links = this.getPanelLinks();
		if (links.length === 0) {
			return;
		}
		const focusedElement = this._document.activeElement as HTMLAnchorElement;
		const focusedIndex = links.indexOf(focusedElement);
		const nextIndex = getNextRowIndex(event.key, focusedIndex, links.length);
		if (nextIndex === null) {
			return;
		}
		event.preventDefault();
		links[nextIndex].focus();
	}

	@HostListener('document:keydown.escape')
	onEscapeKeydown(): void {
		if (!this.isPanelShown) {
			return;
		}
		this.appsPopover?.hide();
		this.triggerRef?.nativeElement.focus();
	}

	private focusFirstLink(): void {
		const links = this.getPanelLinks();
		links[0]?.focus();
	}

	private getPanelLinks(): HTMLAnchorElement[] {
		const panel = this._document.getElementById(this.panelId);
		if (!panel) {
			return [];
		}
		const links = panel.querySelectorAll<HTMLAnchorElement>('a.app-row');
		return Array.from(links);
	}
}
