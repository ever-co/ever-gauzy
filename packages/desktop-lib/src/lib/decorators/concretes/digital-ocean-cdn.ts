import { IUpdaterConfigDigitalOcean } from '../../interfaces';
import { IDesktopCdnUpdate } from '../../interfaces/i-desktop-cdn-update';
import { BaseCdnDecorator } from '../abstracts/base-cdn-decorator';

export class DigitalOceanCdn
	extends BaseCdnDecorator
	implements IDesktopCdnUpdate
{
	private _CDN_HOST: string = 'https://ever.sfo3.cdn.digitaloceanspaces.com';
	private _config: IUpdaterConfigDigitalOcean;

	constructor(update: IDesktopCdnUpdate) {
		super(update);
		this._config = {
			...super.config,
			prereleaseRepository: this.config.repository + '-pre'
		};

		this.url = this.isPrerelease
			? `${this._CDN_HOST}/${this._config.prereleaseRepository}`
			: `${this._CDN_HOST}/${this._config.repository}`;
	}
}
