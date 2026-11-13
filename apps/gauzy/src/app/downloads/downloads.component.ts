import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
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

	constructor(
		@Inject(GAUZY_ENV) environment: Environment,
		private readonly location: Location,
		private readonly router: Router,
		private readonly translateService: TranslateService
	) {
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
