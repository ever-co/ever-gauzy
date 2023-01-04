import { clientTO } from '../dto/client.dto';
import { Base } from './base.model';

export class Client extends Base implements clientTO {
	private _imageUrl: string;
	private _name: string;

	constructor(client: clientTO) {
		super(
			client.id,
			client.organizationId,
			client.remoteId,
			client.tenantId
		);
		this._imageUrl = client.imageUrl;
		this._name = client.name;
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
