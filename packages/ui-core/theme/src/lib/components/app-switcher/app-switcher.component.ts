import { DOCUMENT } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	inject,
	Input,
	OnDestroy,
	ViewChild
} from '@angular/core';
import { NbPopoverDirective, NbPosition } from '@nebular/theme';
import { EVER_APPS, IEverApp, isCurrentEverApp } from '@gauzy/ui-core/common';
import { ElectronService } from '@gauzy/ui-core/core';
import { GAUZY_ENV } from '@gauzy/ui-config';

let nextPanelNumber = 0;

const HOVER_OPEN_DELAY_MS = 120;

const HOVER_CLOSE_DELAY_MS = 200;

// The rotating Ever mark of the Ever websites' header logo: it opens the app list (owner, 2026-11-05).
const EVER_MARK_PATH =
	'M0.301305 30.0417L0.581185 29.3889L4.20635 20.9338L4.20144 20.9242L0.334577 13.3102L0.0104603 12.6721L0.71239 12.4846L9.19627 10.2172L13.1922 1.54579L13.4927 0.893555L14.0859 1.31128L22.1152 6.96599L31.5808 4.42609L32.3695 4.21448L32.336 5.01473L31.9353 14.6145L39.3953 20.0675L40 20.5095L39.4223 20.9851L32.259 26.8807V26.8843L32.243 26.8973L31.9502 36.4851L31.9289 37.179L31.2344 37.0415L22.0143 35.2168L15.0316 40.6565L14.4535 41.1069L14.1245 40.4591L9.84483 32.0334L9.83811 32.0214L1.00836 30.1884L0.301305 30.0417ZM1.96323 29.1895L4.90946 22.3182L9.15843 30.6832L1.96323 29.1895ZM10.6516 30.9931L10.6745 31.0382L21.7022 33.9188L31.048 26.3458L30.7375 15.2001L30.7151 15.1837L30.7182 15.1073L21.8593 8.24458L10.05 11.2081L5.52582 20.9027L10.6516 30.9931ZM14.8657 39.2896L11.3843 32.4357L20.5803 34.8377L14.8657 39.2896ZM30.7765 35.7562L23.1683 34.2506L31.0167 27.8909L30.7765 35.7562ZM38.0756 20.5639L32.2172 25.3857L31.9583 16.0925L38.0756 20.5639ZM31.1081 5.7671L30.7787 13.6611L23.2948 7.86365L31.1081 5.7671ZM13.9812 2.67982L20.6111 7.34897L10.6813 9.84084L13.9812 2.67982ZM1.72897 13.4267L8.55107 11.6035L4.84103 19.5536L1.72897 13.4267ZM38.8031 18.0737L33.1326 6.90982L32.7945 7.07455L38.4651 18.2384L38.8031 18.0737ZM15.8809 1.53828L29.1717 4.18404L29.0965 4.54643L15.8057 1.90068L15.8809 1.53828ZM2.31222 10.6603L11.1714 2.64427L10.9153 2.37262L2.05606 10.3887L2.31222 10.6603ZM0.677161 15.1468L0.377393 27.2163L0 27.2072L0.29976 15.1379L0.677161 15.1468ZM12.6515 39.1303L2.54456 31.3383L2.3111 31.6289L12.4181 39.4208L12.6515 39.1303ZM29.3893 38.1013L17.4202 40.8246L17.3348 40.4644L29.3039 37.7409L29.3893 38.1013ZM32.8416 34.9313L38.7593 22.992L38.4196 22.8304L32.5019 34.7697L32.8416 34.9313Z';

type OpenReason = 'hover' | 'press';

function isMousePointer(event: PointerEvent): boolean {
	return event.pointerType === 'mouse';
}

function containsNode(container: Element | null | undefined, node: Node | null): boolean {
	if (!container || !node) {
		return false;
	}
	return container.contains(node);
}

/**
 * The current app's row as this deployment serves it: its own `CLIENT_BASE_URL` (a self-hosted installation is not
 * the Ever-hosted one), or the catalog's entry when that setting is missing or is not a web address.
 */
function withDeploymentAddress(app: IEverApp, clientBaseUrl: string | undefined): IEverApp {
	if (!isCurrentEverApp(app) || !clientBaseUrl) {
		return app;
	}
	try {
		const { protocol, host } = new URL(clientBaseUrl);
		const isWebAddress = protocol === 'http:' || protocol === 'https:';
		if (!isWebAddress || !host) {
			return app;
		}
		return { ...app, url: clientBaseUrl, domain: host };
	} catch {
		return app;
	}
}

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
	standalone: false,
	/** Without a catalog there is nothing to switch to: the host is hidden. */
	host: { '[attr.hidden]': 'apps.length === 0 ? "" : null' }
})
export class AppSwitcherComponent implements OnDestroy {
	private readonly _electronService = inject(ElectronService);
	private readonly _document = inject(DOCUMENT);
	private readonly _environment = inject(GAUZY_ENV, { optional: true });

	@Input() compact = false;

	@ViewChild('trigger') readonly triggerRef?: ElementRef<HTMLButtonElement>;
	@ViewChild('appsPopover') readonly appsPopover?: NbPopoverDirective;

	/** The catalog the deployment provides (`EVER_APPS`), each row as this deployment serves it. */
	readonly apps: ReadonlyArray<IEverApp> = inject(EVER_APPS).map((app) =>
		withDeploymentAddress(app, this._environment?.CLIENT_BASE_URL)
	);

	readonly markPath = EVER_MARK_PATH;
	readonly panelId: string;
	readonly markGradientId: string;
	readonly markGradientFill: string;

	isPanelShown = false;

	private openReason: OpenReason = 'press';
	private hoverTimer: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		nextPanelNumber += 1;
		this.panelId = `gauzy-app-switcher-panel-${nextPanelNumber}`;
		this.markGradientId = `gauzy-app-switcher-mark-${nextPanelNumber}`;
		this.markGradientFill = `url(#${this.markGradientId})`;
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
	}

	// A click on a list opened by hover pins it open instead of closing it.
	onTriggerClick(): void {
		this.clearHoverTimer();
		if (!this.isPanelShown) {
			this.showPanel('press');
			return;
		}
		const isPinned = this.openReason === 'press';
		if (isPinned) {
			this.hidePanel();
			return;
		}
		// Pinning a list opened by hover moves the focus into it, as opening it by a press does
		this.openReason = 'press';
		setTimeout(() => this.focusFirstLink());
	}

	onPointerEnter(event: PointerEvent): void {
		if (!isMousePointer(event)) {
			return;
		}
		this.clearHoverTimer();
		if (this.isPanelShown) {
			return;
		}
		this.hoverTimer = setTimeout(() => this.showPanel('hover'), HOVER_OPEN_DELAY_MS);
	}

	onPointerLeave(event: PointerEvent): void {
		if (!isMousePointer(event)) {
			return;
		}
		this.clearHoverTimer();
		const isPinned = this.openReason === 'press';
		if (isPinned) {
			return;
		}
		this.hoverTimer = setTimeout(() => this.hidePanel(), HOVER_CLOSE_DELAY_MS);
	}

	onAppPick(event: MouseEvent, app: IEverApp): void {
		// Inside the desktop apps a plain link would load the other app into the Gauzy window itself.
		const shell = this._electronService.shell;
		const canOpenInSystemBrowser = typeof shell?.openExternal === 'function';
		this.hidePanel();
		// Hiding detaches the row that held the focus: give it back to the button, as Escape does
		this.triggerRef?.nativeElement.focus();
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
		this.hidePanel();
		this.triggerRef?.nativeElement.focus();
	}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent): void {
		if (!this.isPanelShown) {
			return;
		}
		const target = event.target as Node | null;
		const isOnTrigger = containsNode(this.triggerRef?.nativeElement, target);
		const isInPanel = containsNode(this._document.getElementById(this.panelId), target);
		if (isOnTrigger || isInPanel) {
			return;
		}
		this.hidePanel();
	}

	ngOnDestroy(): void {
		this.clearHoverTimer();
	}

	private showPanel(reason: OpenReason): void {
		this.openReason = reason;
		this.appsPopover?.show();
		const isPressed = reason === 'press';
		if (isPressed) {
			setTimeout(() => this.focusFirstLink());
		}
	}

	private hidePanel(): void {
		this.clearHoverTimer();
		this.appsPopover?.hide();
	}

	private clearHoverTimer(): void {
		clearTimeout(this.hoverTimer);
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
