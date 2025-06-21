import { ICamshot as ICamshotCore, ICloneable, ID, IEmployee } from '@gauzy/contracts';

export interface ICamshot extends ICamshotCore {
	id: string;
	isDeleted?: boolean;
	deletedAt?: Date;
	uploadedBy?: IEmployee;
}

export class Camshot implements ICamshot, ICloneable<Camshot> {
	public id: ID;
	public title: string;
	public recordedAt?: Date;
	public fullUrl?: string;
	public thumbUrl?: string;
	public size?: number;
	public deletedAt?: Date;
	public uploadedBy?: IEmployee;

	constructor(camshot: ICamshot) {
		Object.assign(this, camshot);
	}

	public get isDeleted(): boolean {
		return !!this.deletedAt;
	}

	public clone(): Camshot {
		return new Camshot(this);
	}
}
