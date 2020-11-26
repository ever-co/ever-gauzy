export interface ILocation {
	type: 'Point';
	coordinates: [number, number];
}

export interface IAddress {
	country: '' | null;
	city: string | null;
	postcode?: string | null;
	address: string | null;
	address2: string | null;
}

export function getEmptyAddress(): IAddress {
	return {
		country: '',
		city: '',
		postcode: '',
		address: '',
		address2: ''
	};
}

export interface IGeoLocationCreateObject extends IAddress {
	loc: ILocation;
}

export interface IGeolocationUpdateObject extends IAddress {
	loc?: ILocation;
}
