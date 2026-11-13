import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	ElementRef,
	HostListener,
	Inject,
	inject,
	Injector,
	NgZone,
	signal
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';

type DesktopPlatform = 'windows' | 'macos' | 'linux';

/** One desktop installer. `name` is the OS's own name, so it is not translated. */
interface IDesktopDownload {
	platform: DesktopPlatform;
	name: string;
	icon: string;
	url: string;
}

/** Where a drawn "You" cursor is, for one second of the loop, and whether it clicks there. */
interface ICursorStep<T extends string> {
	at: T;
	press?: boolean;
}

/** Length of the drawings' animation loop, in seconds (one step per second). */
const LOOP_SECONDS = 12;

/**
 * Desktop window: the cursor picks a project, hovers the pause button, then opens Client, while
 * the clock keeps running.
 */
const DESKTOP_SCRIPT: ICursorStep<'team' | 'project' | 'pause' | 'client'>[] = [
	{ at: 'team' },
	{ at: 'project' },
	{ at: 'project', press: true },
	{ at: 'project' },
	{ at: 'pause' },
	{ at: 'pause' },
	{ at: 'pause' },
	{ at: 'client' },
	{ at: 'client', press: true },
	{ at: 'client' },
	{ at: 'team' },
	{ at: 'team' }
];

/**
 * Browser extension: the cursor starts the timer (second 3), lets it run, then stops it
 * (second 10). Indexes here line up with {@link EXTENSION_START} and {@link EXTENSION_STOP}.
 */
const EXTENSION_SCRIPT: ICursorStep<'rest' | 'play'>[] = [
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'play' },
	{ at: 'play', press: true },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'play' },
	{ at: 'play', press: true },
	{ at: 'rest' }
];
const EXTENSION_START = 3;
const EXTENSION_STOP = 10;

/**
 * The apps a user can install next to the web app: the desktop timer, the mobile app and the
 * browser extension. Every link comes from the environment (the same ones the user menu's
 * "Download apps" icons use), so a self-hosted install can point them at its own builds; an
 * empty link hides its button, and a card with no links left is not shown.
 */
@Component({
	selector: 'ngx-downloads',
	templateUrl: './downloads.component.html',
	styleUrls: ['./downloads.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class DownloadsComponent {
	/** The installer for the OS this page is open on — the Desktop card's main button. */
	readonly primaryDesktop: IDesktopDownload | null;
	/** The other desktop installers, offered as plain links under the main button. */
	readonly otherDesktops: IDesktopDownload[];
	readonly mobileUrl: string;
	readonly extensionUrl: string;
	/** The product site's full downloads page (older versions, server builds, …). */
	readonly allDownloadsUrl: string;

	/** Bar heights (%) for the Mobile card's illustration — a made-up week, Monday first. */
	readonly weekBars = [62, 84, 48, 92, 70, 18, 6];

	/** Cache for {@link lastCaptureAgo}, keyed by language. */
	private captureAgo = { lang: '', text: '' };

	private readonly injector = inject(Injector);

	/** Viewer asked for less motion: the scripted loop stays on its first frame. */
	private readonly reducedMotion =
		typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	/**
	 * Seconds of scripted loop played: the one clock both cursors read, so a cursor's click and the
	 * timer it starts or stops always land on the same frame. Advances only while a drawing is on
	 * screen and the tab is visible (see {@link startAnimationClock}).
	 */
	private readonly tick = signal(0);
	private readonly step = computed(() => this.tick() % LOOP_SECONDS);

	/**
	 * Hands-on mode: while the pointer is over a drawing, its cursor steps aside and the drawn
	 * timer answers the visitor's own clicks instead of the script.
	 */
	readonly desktopTakeover = signal(false);
	readonly extensionTakeover = signal(false);

	/** Desktop window: a clock running from 00:00:05 (the visitor can pause it), and the cursor's step. */
	readonly desktopRunning = signal(true);
	private readonly desktopSeconds = signal(5);
	readonly desktopClock = computed(() => formatClock(this.desktopSeconds()));
	readonly desktopCursor = computed(() => DESKTOP_SCRIPT[this.step()]);

	/** Browser extension: the visitor's own session, used in hands-on mode. */
	private readonly manualRunning = signal(false);
	private readonly manualSeconds = signal(0);

	/** Browser extension: whether the drawn timer is running, its reading, and the cursor's step. */
	readonly extensionRunning = computed(() =>
		this.extensionTakeover() ? this.manualRunning() : this.step() >= EXTENSION_START && this.step() < EXTENSION_STOP
	);
	readonly extensionClock = computed(() => {
		if (this.extensionTakeover()) {
			return formatClock(this.manualSeconds());
		}
		return formatClock(this.extensionRunning() ? this.step() - EXTENSION_START : 0);
	});
	readonly extensionCursor = computed(() => EXTENSION_SCRIPT[this.step()]);

	/**
	 * Set once the visitor clicks a desktop download: opens the setup steps under the button for
	 * that platform. Desktop links open in a new tab, so this page stays put to show them.
	 */
	readonly startedDownload = signal<IDesktopDownload | null>(null);
	/** Where the desktop app should connect: this installation's API, as the About page shows it. */
	readonly apiHost: string;
	/** The API is Gauzy's own cloud, so the desktop app's "Live" option is the one to pick. */
	readonly isLiveServer: boolean;
	readonly apiHostCopied = signal(false);
	private copiedTimer: ReturnType<typeof setTimeout> | null = null;

	/** Opened on a phone: the Mobile card leads the page. */
	readonly isPhone = detectPhone();

	constructor(
		@Inject(GAUZY_ENV) environment: Environment,
		private readonly location: Location,
		private readonly router: Router,
		private readonly translateService: TranslateService,
		private readonly host: ElementRef<HTMLElement>,
		ngZone: NgZone,
		destroyRef: DestroyRef
	) {
		this.startAnimationClock(ngZone, destroyRef);
		destroyRef.onDestroy(() => this.copiedTimer && clearTimeout(this.copiedTimer));

		const desktops: IDesktopDownload[] = [
			{
				platform: 'windows',
				name: 'Windows',
				icon: 'fab fa-windows',
				url: environment.DESKTOP_APP_DOWNLOAD_LINK_WINDOWS
			},
			{
				platform: 'macos',
				name: 'macOS',
				icon: 'fab fa-apple',
				url: environment.DESKTOP_APP_DOWNLOAD_LINK_APPLE
			},
			{
				platform: 'linux',
				name: 'Linux',
				icon: 'fab fa-linux',
				url: environment.DESKTOP_APP_DOWNLOAD_LINK_LINUX
			}
		].filter((desktop) => !!desktop.url) as IDesktopDownload[];

		const detected = detectDesktopPlatform();
		this.primaryDesktop = desktops.find((desktop) => desktop.platform === detected) ?? desktops[0] ?? null;
		this.otherDesktops = desktops.filter((desktop) => desktop !== this.primaryDesktop);
		this.mobileUrl = environment.MOBILE_APP_DOWNLOAD_LINK || '';
		this.extensionUrl = environment.EXTENSION_DOWNLOAD_LINK || '';
		this.allDownloadsUrl = environment.PLATFORM_WEBSITE_DOWNLOAD_URL || '';

		this.apiHost = environment.API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
		this.isLiveServer = isGauzyCloud(this.apiHost);
	}

	/** A desktop download link was clicked: show the setup steps for that platform. */
	onDesktopDownload(download: IDesktopDownload): void {
		this.startedDownload.set(download);
	}

	/**
	 * Copies the API host for the desktop app's setup; the button reads "Copied!" for 1.5s.
	 * `navigator.clipboard` exists only in secure contexts, so a self-hosted install opened over
	 * plain HTTP falls back to a selected textarea + `execCommand('copy')` (as on the About page).
	 */
	copyApiHost(): void {
		const done = () => {
			this.apiHostCopied.set(true);
			if (this.copiedTimer) {
				clearTimeout(this.copiedTimer);
			}
			this.copiedTimer = setTimeout(() => this.apiHostCopied.set(false), 1500);
		};
		if (navigator?.clipboard?.writeText) {
			navigator.clipboard
				.writeText(this.apiHost)
				.then(done)
				.catch(() => copyWithSelection(this.apiHost) && done());
			return;
		}
		if (copyWithSelection(this.apiHost)) {
			done();
		}
	}

	/** Hands-on desktop window: pointer in → the visitor drives; pointer out → back to the script. */
	setDesktopTakeover(active: boolean): void {
		this.desktopTakeover.set(active);
		if (!active) {
			this.desktopRunning.set(true);
		}
	}

	/** The drawn desktop pause / play button. */
	toggleDesktopTimer(): void {
		this.desktopRunning.update((running) => !running);
	}

	/** Hands-on extension timer: each visit starts from a stopped 00:00:00. */
	setExtensionTakeover(active: boolean): void {
		this.extensionTakeover.set(active);
		this.manualRunning.set(false);
		this.manualSeconds.set(0);
	}

	/** The drawn extension play / pause button; stopping resets the session, as the web timer does. */
	toggleExtensionTimer(): void {
		const running = !this.manualRunning();
		this.manualRunning.set(running);
		if (!running) {
			this.manualSeconds.set(0);
		}
	}

	/** Esc leaves the page, like the top bar's back arrow. */
	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.goBack();
	}

	/**
	 * "5 hours ago" for the drawn desktop window's last-capture line, in the app's language
	 * ("il y a 5 heures", "vor 5 Stunden"…). `Intl.RelativeTimeFormat` does the wording, so no
	 * translation key is needed; a language it does not know falls back to the browser's own.
	 * Read on each check (the translate pipes beside it refresh on a language switch), so the
	 * result is cached per language.
	 */
	get lastCaptureAgo(): string {
		const lang = this.translateService.getCurrentLang() || 'en';
		if (this.captureAgo.lang !== lang) {
			let text: string;
			try {
				text = new Intl.RelativeTimeFormat(lang, { numeric: 'always' }).format(-5, 'hour');
			} catch {
				text = '5 hours ago';
			}
			this.captureAgo = { lang, text };
		}
		return this.captureAgo.text;
	}

	/**
	 * The drawings' one-second clock. Each second it advances the scripted loop, the desktop clock
	 * and the visitor's own extension session — but only while an animated drawing is on screen and
	 * the tab is visible, so a background tab or a scrolled-away page costs nothing. The interval
	 * runs outside Angular's zone so it does not run change detection for the whole app; the signal
	 * writes refresh only this view. For reduced motion the script and the self-running clock stay
	 * still, while a visitor's own clicks on the drawn timers still count.
	 */
	private startAnimationClock(ngZone: NgZone, destroyRef: DestroyRef): void {
		if (typeof window === 'undefined') {
			return;
		}
		const onScreen = new Set<Element>();
		let observer: IntersectionObserver | null = null;

		// The drawings exist only after the first render; until the observer reports, assume visible.
		afterNextRender(
			() => {
				if (typeof IntersectionObserver === 'undefined') {
					return;
				}
				const io = new IntersectionObserver((entries) => {
					for (const entry of entries) {
						if (entry.isIntersecting) {
							onScreen.add(entry.target);
						} else {
							onScreen.delete(entry.target);
						}
					}
				});
				this.host.nativeElement.querySelectorAll('.art-desktop, .art-extension').forEach((target) => {
					onScreen.add(target);
					io.observe(target);
				});
				observer = io;
			},
			{ injector: this.injector }
		);

		const timer = ngZone.runOutsideAngular(() =>
			setInterval(() => {
				if (document.hidden || (observer && onScreen.size === 0)) {
					return;
				}
				if (!this.reducedMotion) {
					this.tick.update((t) => t + 1);
				}
				if (this.desktopRunning() && (!this.reducedMotion || this.desktopTakeover())) {
					this.desktopSeconds.update((s) => s + 1);
				}
				if (this.extensionTakeover() && this.manualRunning()) {
					this.manualSeconds.update((s) => s + 1);
				}
			}, 1000)
		);
		destroyRef.onDestroy(() => {
			clearInterval(timer);
			observer?.disconnect();
		});
	}

	/**
	 * The top bar's back arrow: returns to the page the user came from. Angular numbers its
	 * navigations in `history.state.navigationId`, starting at 1 for the first page of the session —
	 * so when this page was opened directly (a bookmark, a new tab), there is nothing in the app to
	 * go back to, and the arrow goes to the dashboard instead of leaving the app.
	 */
	goBack(): void {
		const navigationId = (this.location.getState() as { navigationId?: number } | null)?.navigationId ?? 1;
		if (navigationId > 1) {
			this.location.back();
		} else {
			this.router.navigateByUrl('/pages/dashboard');
		}
	}
}

/** A phone (not a tablet or desktop), where the mobile app is the one to offer first. */
function detectPhone(): boolean {
	if (typeof navigator === 'undefined') {
		return false;
	}
	const hints = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
	if (typeof hints?.mobile === 'boolean') {
		return hints.mobile;
	}
	return /iphone|ipod|android.*mobile|windows phone/i.test(navigator.userAgent ?? '');
}

/** Gauzy's own cloud API (api.gauzy.co and its subdomains), which the desktop app reaches as "Live". */
function isGauzyCloud(apiHost: string): boolean {
	try {
		return /(^|\.)gauzy\.co$/i.test(new URL(apiHost).hostname);
	} catch {
		return false;
	}
}

/** Legacy copy path for non-secure contexts. Returns whether the browser reported success. */
function copyWithSelection(value: string): boolean {
	const field = document.createElement('textarea');
	field.value = value;
	field.setAttribute('readonly', '');
	field.style.position = 'fixed';
	field.style.opacity = '0';
	document.body.appendChild(field);
	field.select();
	let copied = false;
	try {
		copied = document.execCommand('copy');
	} catch {
		copied = false;
	}
	document.body.removeChild(field);
	return copied;
}

/** Seconds as `HH:MM:SS`, the way both timers show a reading. */
function formatClock(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Best guess at the viewer's desktop OS, from User-Agent Client Hints where the browser has them
 * and the user agent string otherwise. Phones and tablets fall through to Windows, the most
 * common desktop, since the main button is a desktop installer either way.
 */
function detectDesktopPlatform(): DesktopPlatform {
	if (typeof navigator === 'undefined') {
		return 'windows';
	}
	const hint = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '';
	const source = `${hint} ${navigator.userAgent ?? ''}`.toLowerCase();
	if (/iphone|ipad|android/.test(source)) {
		return 'windows';
	}
	if (/mac/.test(source)) {
		return 'macos';
	}
	if (/linux|x11|cros/.test(source)) {
		return 'linux';
	}
	return 'windows';
}
