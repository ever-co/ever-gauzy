import { Serializable } from '../../interfaces';
import { TagTO } from '../dto/tag.dto';
import { Base } from './base.model';

export class Tag extends Base implements TagTO, Serializable<TagTO> {
	private _color: string;
	private _name: string;

	constructor(tag: TagTO) {
		super(tag.id, tag.organizationId, tag.remoteId, tag.tenantId);
		this._color = tag.color;
		this._name = tag.name;
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

	public toObject(): TagTO {
		return {
			...super.toObject(),
			name: this._name,
			color: this._color
		};
	}
}
