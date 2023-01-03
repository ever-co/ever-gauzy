import { TagTO } from '../dto/tag.dto';
import { Base } from './base.model';

export class Tag extends Base implements TagTO {
	private _color: string;
	private _name: string;

	constructor(
		color: string,
		name: string,
		id?: number,
		organizationId?: string,
		remoteId?: string,
		tenantId?: string
	) {
		super(id, organizationId, remoteId, tenantId);
		this._color = color;
		this._name = name;
	}

	public get color(): string {
		return this._color;
	}
	public set color(value: string) {
		this._color = value;
	}
	public get name(): string {
		return this._name;
	}
	public set name(value: string) {
		this._name = value;
	}
}
