import { IDesktopCdnUpdate } from "../../interfaces/i-desktop-cdn-update";
import { UpdateStrategy } from "../abstracts/update-strategy";
import fetch from 'node-fetch';
import IUpdaterConfig from "../../interfaces/i-updater-config";
import { app } from "electron";
import { LocalStore } from "../../desktop-store";

// A tag looked up this recently is reused, so an explicit initialize() followed by the check's own
// lookup (startup, strategy change) costs one GitHub API call, not two.
const TAG_REUSE_MS = 60 * 1000;
const LOOKUP_TIMEOUT_MS = 10 * 1000;

export class CdnUpdate extends UpdateStrategy implements IDesktopCdnUpdate {
    private _config: IUpdaterConfig;
    private _lastTag: { name: string; prerelease: boolean; resolvedAt: number } = null;

    constructor(config: IUpdaterConfig) {
        super();
        this._config = config;
    }

    public get url(): string {
        return this._url;
    }

    public set url(value: string) {
        this._url = value;
    }

    /**
     * Resolves the tag of the newest release on the user's channel: stable releases only, or, with the
     * prerelease channel enabled, the newest release of either kind. A failed lookup keeps the last
     * resolved tag, or falls back to the running version's tag (releases are tagged v<version>), so the
     * feed URL is never built from a malformed tag.
     */
    public async tagName(): Promise<string> {
		let prerelease: boolean;
		try {
			prerelease = this.isPrerelease;
			if (this._lastTag?.prerelease === prerelease && Date.now() - this._lastTag.resolvedAt < TAG_REUSE_MS) {
				return this._lastTag.name;
			}
			const response = await fetch(
				`https://api.github.com/repos/${this.config.owner}/${this.config.repository}/${this.config.typeRelease}`,
				{
					method: 'GET',
					headers: {
						Accept: 'application/vnd.github+json'
					},
					// This lookup now runs before every check; never let a hung connection stall it.
					timeout: LOOKUP_TIMEOUT_MS
				}
			);
			const releases = await response.json();
			// Errors, e.g. the unauthenticated 60 requests/hour rate limit, answer with an object.
			if (!Array.isArray(releases)) {
				throw new Error(`GitHub API ${response.status}: ${releases?.message}`);
			}
			// The prerelease channel adds prerelease builds to the stable releases instead of replacing
			// them, so a stable release published after the last prerelease still reaches those users.
			const matching = releases.filter((release) => prerelease || release.prerelease === false);
			// A release is published before its per-platform update files are uploaded (up to an hour
			// later), so prefer the newest one that already carries this platform's file.
			const updateInfoFile = this._updateInfoFile;
			const release =
				matching.find((release) => release.assets?.some((asset) => asset.name === updateInfoFile)) ??
				matching[0];
			if (!release?.tag_name) {
				throw new Error(`No ${prerelease ? '' : 'stable '}release found`);
			}
			this._lastTag = { name: release.tag_name, prerelease, resolvedAt: Date.now() };
			return release.tag_name;
		} catch (e) {
			console.log('Error', e);
			return this._lastTag && this._lastTag.prerelease === prerelease ? this._lastTag.name : `v${app.getVersion()}`;
		}
    }

    public get config(): IUpdaterConfig {
        return this._config;
    }

    public get isPrerelease(): boolean {
        const setting = LocalStore.getStore('appSetting');
        return !!setting?.prerelease;
    }

    /**
     * The update-info file electron-updater's generic provider requests for the channel UpdateStrategy
     * sets: latest-<arch> on win32 and linux (with its -linux[-<arch>] suffix), latest on darwin.
     */
    private get _updateInfoFile(): string {
        const { platform, arch } = process;
        if (platform === 'win32') return `latest-${arch}.yml`;
        if (platform === 'linux') return `latest-${arch}-linux${arch === 'x64' ? '' : `-${arch}`}.yml`;
        return platform === 'darwin' ? 'latest-mac.yml' : null;
    }
}
