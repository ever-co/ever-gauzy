import { clientTO } from '../dto/client.dto';
import { Base } from './base.model';

export class Client extends Base implements clientTO {
	private _imageUrl: string;
	private _name: string;

	constructor(
		imageUrl: string,
		name: string,
		id?: number,
		organizationId?: string,
		remoteId?: string,
		tenantId?: string
	) {
		super(id, organizationId, remoteId, tenantId);
		this._imageUrl = imageUrl;
		this._name = name;
	}

	public get name(): string {
		return this._name;
	}
	public set name(value: string) {
		this._name = value;
	}
	public get imageUrl(): string {
		return this._imageUrl;
	}
	public set imageUrl(value: string) {
		this._imageUrl = value;
	}
}
