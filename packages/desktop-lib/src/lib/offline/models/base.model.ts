import { Serializable } from '../../interfaces';
import { BaseTO } from '../dto/base.dto';

export abstract class Base implements BaseTO, Serializable<BaseTO> {
	private _id?: number;
	private _organizationId: string;
	private _remoteId: string;
	private _tenantId: string;

	constructor(
		id?: number,
		organizationId?: string,
		remoteId?: string,
		tenantId?: string
	) {
		this._id = id;
		this._organizationId = organizationId;
		this._remoteId = remoteId;
		this._tenantId = tenantId;
	}

	public get id(): number {
		return this._id;
	}
	public set id(value: number) {
		this._id = value;
	}
	public get remoteId(): string {
		return this._remoteId;
	}
	public set remoteId(value: string) {
		this._remoteId = value;
	}
	public get tenantId(): string {
		return this._tenantId;
	}
	public set tenantId(value: string) {
		this._tenantId = value;
	}
	public get organizationId(): string {
		return this._organizationId;
	}
	public set organizationId(value: string) {
		this._organizationId = value;
	}
	public toObject(): BaseTO {
		return {
			remoteId: this._remoteId,
			tenantId: this._tenantId,
			organizationId: this._organizationId
		};
	}
}
