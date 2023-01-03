import { ProjectTO } from '../dto/project.dto';
import { Base } from './base.model';

export class Project extends Base implements ProjectTO {
	private _contactId: string;
	private _description: string;
	private _imageUrl?: string;
	private _name: string;
	private _organizationContactId?: string;

	constructor(
		contactId: string,
		description: string,
		imageUrl: string,
		name: string,
		organizationContactId: string,
		id?: number,
		organizationId?: string,
		remoteId?: string,
		tenantId?: string
	) {
		super(id, organizationId, remoteId, tenantId);
		this._contactId = contactId;
		this._description = description;
		this._imageUrl = imageUrl;
		this._name = name;
		this._organizationContactId = organizationContactId;
	}

	public get contactId(): string {
		return this._contactId;
	}
	public set contactId(value: string) {
		this._contactId = value;
	}
	public get description(): string {
		return this._description;
	}
	public set description(value: string) {
		this._description = value;
	}
	public get imageUrl(): string {
		return this._imageUrl;
	}
	public set imageUrl(value: string) {
		this._imageUrl = value;
	}
	public get name(): string {
		return this._name;
	}
	public set name(value: string) {
		this._name = value;
	}
	public get organizationContactId(): string {
		return this._organizationContactId;
	}
	public set organizationContactId(value: string) {
		this._organizationContactId = value;
	}
}
