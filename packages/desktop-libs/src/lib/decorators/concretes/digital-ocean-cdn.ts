import { IDesktopCdnUpdate } from '../../interfaces/i-desktop-cdn-update';
import { BaseCdnDecorator } from '../abstracts/base-cdn-decorator';

export class DigitalOceanCdn
	extends BaseCdnDecorator
	implements IDesktopCdnUpdate {
	private _CDN_HOST: string = 'https://ever.sfo3.cdn.digitaloceanspaces.com'
	constructor(update: IDesktopCdnUpdate) {
		super(update);
		this.url = `${this._CDN_HOST}/${this.config.repository}`;
	}
}
