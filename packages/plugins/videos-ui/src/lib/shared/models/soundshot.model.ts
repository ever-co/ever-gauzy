import { ISoundshot as ISoundshotCore, ICloneable, ID, IEmployee } from '@gauzy/contracts';

export interface ISoundshot extends ISoundshotCore {
	id: string;
	isDeleted?: boolean;
	deletedAt?: Date;
	uploadedBy?: IEmployee;
}

export class Soundshot implements ISoundshot, ICloneable<Soundshot> {
	public id: ID;
	public name: string;
	public recordedAt?: Date;
	public fullUrl?: string;
	public size?: number;
	public duration?: number;
	public deletedAt?: Date;
	public uploadedBy?: IEmployee;

	constructor(soundshot: ISoundshot) {
		Object.assign(this, soundshot);
	}

	public get isDeleted(): boolean {
		return !!this.deletedAt;
	}

	public clone(): Soundshot {
		return new Soundshot(this);
	}
}
