export interface ILocation {
	type: 'Point';
	coordinates: [number, number];
}

export interface IAddress {
	country: string | null;
	city: string | null;
	postcode?: number | null;
	address: string | null;
	address2: string | null;
}

export function getEmptyAddress(): IAddress {
	return {
		country: null,
		city: null,
		postcode: null,
		address: null,
		address2: null
	};
}

export interface IGeoLocationCreateObject extends IAddress {
	loc?: ILocation;
}

export interface IGeolocationUpdateObject extends IAddress {
	loc?: ILocation;
}
