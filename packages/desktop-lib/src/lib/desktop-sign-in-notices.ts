import { BrowserWindow, clipboard, dialog, MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import { store } from '@gauzy/desktop-core';
import {
	DESKTOP_SEED_CREDENTIALS_STORE_KEY,
	DesktopSeedAccountEmails,
	DesktopSeedAccountKey,
	DesktopSeedCredentials,
	ensureDesktopSeedCredentials,
	findDesktopSeededAccounts,
	StoredDesktopSeedCredentials
} from './config/desktop-seed-credentials';
import { TranslateService } from './translation';

/** Translation key and English text of each default account's role. */
const ROLE_LABELS: Readonly<Record<DesktopSeedAccountKey, readonly [string, string]>> = Object.freeze({
	superAdmin: ['TIMER_TRACKER.DIALOG.SEED_ROLE_SUPER_ADMIN', 'Super Admin'],
	admin: ['TIMER_TRACKER.DIALOG.SEED_ROLE_ADMIN', 'Admin'],
	employee: ['TIMER_TRACKER.DIALOG.SEED_ROLE_EMPLOYEE', 'Employee']
});

/**
 * Translates `key`, falling back to the English `fallback` when no translation is loaded for it. The
 * generated passwords exist nowhere else, so this dialog must never fail or show raw keys.
 */
function translate(key: string, fallback: string, params?: Record<string, string>): string {
	let text: string;
	try {
		text = TranslateService.instant(key, params);
	} catch {
		text = key;
	}
	if (!text || text === key) {
		text = fallback.replace(/{{\s*([^}\s]+)\s*}}/g, (match, name) => params?.[name] ?? match);
	}
	return text;
}

/**
 * The sign-in notices of the desktop apps that run the API locally (Gauzy Desktop with the
 * integrated server, Gauzy Server, Gauzy API Server).
 *
 * - Before each start the app takes this install's random seed passwords from
 *   {@link provisionSeedCredentials} and hands them to the API (`DEMO_*_PASSWORD`).
 * - When the API reports that it began seeding a new database, {@link recordSeed} marks the accounts
 *   that receive them (at the start, so a seed that fails after creating them still shows them),
 *   with the emails the API reported for them. {@link show} then displays them in a native dialog, at
 *   every start until the user confirms they saved them; the stored copy is deleted at that moment,
 *   so they are shown once.
 * - When the API reports, at boot, accounts of an existing database still using a published
 *   password (such as the Super Admin's `admin`, from an install made before these passwords),
 *   {@link show} warns once per run. Those accounts are not changed: the user keeps signing in as
 *   before.
 */
export class DesktopSignInNotices {
	private static publishedPasswordAccounts: string[] = [];
	private static publishedPasswordsShown = false;
	/** The notices shown so far, in order: each `show()` runs after the previous one has finished. */
	private static showing: Promise<void> = Promise.resolve();
	/** Set by the first `show()`: from then on a new record is shown as soon as it arrives. */
	private static showRequested = false;
	private static lastWindow: BrowserWindow | null = null;

	private constructor() {}

	/**
	 * This install's seed passwords, generated and stored on first use. Call before starting the API.
	 */
	public static provisionSeedCredentials(): DesktopSeedCredentials {
		const { credentials, changed } = ensureDesktopSeedCredentials(this.read());
		if (changed) {
			this.write(credentials);
		}
		return credentials;
	}

	/**
	 * The API began seeding a new database: remembers which accounts get the generated passwords.
	 * Recorded at the start because the accounts keep these passwords even if a later seed step fails,
	 * and no later start seeds again once users exist. Their passwords are never replaced from now on,
	 * so a seed that failed before creating them and runs again uses the same ones.
	 *
	 * @param env - The environment the API process ran with (inherited variables included).
	 * @param reportedEmails - The emails the API reported for the accounts of its seed.
	 */
	public static recordSeed(
		env: Record<string, string | undefined>,
		reportedEmails: DesktopSeedAccountEmails = {}
	): void {
		try {
			const stored = this.read();
			const accounts = findDesktopSeededAccounts(stored, env, reportedEmails);
			if (accounts.length > 0) {
				this.write({ ...stored, pending: accounts });
				this.showIfRequested();
			}
		} catch (error) {
			console.error('Could not record the generated sign-in passwords:', error?.message ?? error);
		}
	}

	/**
	 * The API reported accounts that still sign in with a published password. The API writes that
	 * report to stderr, which can reach the app after "Listening at" on stdout, that is after the app
	 * called {@link show}; it is then shown on arrival.
	 *
	 * @param emails - Their emails, as the API printed them.
	 */
	public static recordPublishedPasswords(emails: string[]): void {
		if (emails.length > 0) {
			this.publishedPasswordAccounts = Array.from(new Set(emails));
			this.showIfRequested();
		}
	}

	/**
	 * Shows what is pending: the generated passwords of a new database, then the published-password
	 * warning. Never throws. A call made while a dialog is open runs after it, so nothing is shown
	 * twice (confirmed passwords are deleted, the warning is shown once per run).
	 *
	 * @param window - The window to attach the dialog to, if it is still open.
	 */
	public static show(window?: BrowserWindow | null): Promise<void> {
		this.showRequested = true;
		if (window) {
			this.lastWindow = window;
		}
		const target = window ?? this.lastWindow;
		this.showing = this.showing.then(() => this.showAll(target));
		return this.showing;
	}

	private static showIfRequested(): void {
		if (this.showRequested) {
			void this.show();
		}
	}

	private static async showAll(window?: BrowserWindow | null): Promise<void> {
		try {
			await this.showSeedCredentials(window);
			await this.showPublishedPasswordWarning(window);
		} catch (error) {
			console.error('Could not show the sign-in notice:', error?.message ?? error);
		}
	}

	private static async showSeedCredentials(window?: BrowserWindow | null): Promise<void> {
		const stored = this.read();
		const accounts = (stored?.pending ?? []).filter((account) => typeof stored[account.key] === 'string');
		if (accounts.length === 0) {
			return;
		}

		const passwordLabel = translate('TIMER_TRACKER.DIALOG.SEED_PASSWORD', 'Password');
		const text = accounts
			.map(({ key, email }) => {
				const [labelKey, labelFallback] = ROLE_LABELS[key];
				return `${translate(labelKey, labelFallback)}: ${email}\n${passwordLabel}: ${stored[key]}`;
			})
			.join('\n\n');

		const copyButton = 0;
		const savedButton = 1;
		let copied = false;
		for (;;) {
			const detail = translate(
				'TIMER_TRACKER.DIALOG.SEED_CREDENTIALS_DETAIL',
				'This installation created its accounts with random passwords instead of the published defaults.\n\n{{accounts}}\n\nYou can change a password later on your profile page in Gauzy.',
				{ accounts: text }
			);
			const { response } = await this.messageBox(window, {
				type: 'warning',
				title: translate('TIMER_TRACKER.DIALOG.SEED_CREDENTIALS_TITLE', 'Your sign-in details'),
				message: translate(
					'TIMER_TRACKER.DIALOG.SEED_CREDENTIALS_MESSAGE',
					'Save these passwords now. They are shown only once.'
				),
				detail: copied
					? `${detail}\n\n${translate('TIMER_TRACKER.DIALOG.SEED_CREDENTIALS_COPIED', 'Copied to the clipboard.')}`
					: detail,
				buttons: [
					translate('BUTTONS.COPY', 'Copy'),
					translate('TIMER_TRACKER.DIALOG.SEED_CREDENTIALS_SAVED', 'I have saved them')
				],
				defaultId: copyButton,
				// Escape or closing the box copies instead of dismissing: only the explicit button forgets them.
				cancelId: copyButton,
				noLink: true
			});
			if (response === savedButton) {
				break;
			}
			clipboard.writeText(text);
			copied = true;
		}

		store.delete(DESKTOP_SEED_CREDENTIALS_STORE_KEY);
	}

	private static async showPublishedPasswordWarning(window?: BrowserWindow | null): Promise<void> {
		if (this.publishedPasswordsShown || this.publishedPasswordAccounts.length === 0) {
			return;
		}
		this.publishedPasswordsShown = true;

		await this.messageBox(window, {
			type: 'warning',
			title: translate('TIMER_TRACKER.DIALOG.PUBLISHED_PASSWORDS_TITLE', 'Default password still in use'),
			message: translate(
				'TIMER_TRACKER.DIALOG.PUBLISHED_PASSWORDS_MESSAGE',
				'Change the default password of these accounts.'
			),
			detail: translate(
				'TIMER_TRACKER.DIALOG.PUBLISHED_PASSWORDS_DETAIL',
				'{{accounts}} still sign in with the default password published in the Gauzy documentation. Anyone who can reach this server can sign in with it. Sign in to Gauzy and change it on the profile page.',
				{ accounts: this.publishedPasswordAccounts.join(', ') }
			),
			buttons: [translate('BUTTONS.OK', 'OK')],
			defaultId: 0,
			noLink: true
		});
	}

	private static messageBox(
		window: BrowserWindow | null | undefined,
		options: MessageBoxOptions
	): Promise<MessageBoxReturnValue> {
		return window && !window.isDestroyed()
			? dialog.showMessageBox(window, options)
			: dialog.showMessageBox(options);
	}

	private static read(): StoredDesktopSeedCredentials | undefined {
		return store.get(DESKTOP_SEED_CREDENTIALS_STORE_KEY) as StoredDesktopSeedCredentials | undefined;
	}

	private static write(value: StoredDesktopSeedCredentials): void {
		store.set(DESKTOP_SEED_CREDENTIALS_STORE_KEY, value);
	}
}
