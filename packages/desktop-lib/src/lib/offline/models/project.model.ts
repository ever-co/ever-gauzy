import { Serializable } from '../../interfaces';
import { ProjectTO } from '../dto/project.dto';
import { Base } from './base.model';

export class Project
	extends Base
	implements ProjectTO, Serializable<ProjectTO>
{
	private _contactId: string;
	private _description: string;
	private _imageUrl?: string;
	private _name: string;
	private _organizationContactId?: string;

	constructor(project: ProjectTO) {
		super(
			project.id,
			project.organizationId,
			project.remoteId,
			project.tenantId
		);
		this._contactId = project.contactId;
		this._description = project.description;
		this._imageUrl = project.imageUrl;
		this._name = project.name;
		this._organizationContactId = project.organizationContactId;
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
	public toObject(): ProjectTO {
		return {
			...super.toObject(),
			name: this._name,
			imageUrl: this._imageUrl,
			contactId: this._contactId,
			organizationContactId: this._organizationContactId,
			description: this._description
		};
	}
}
