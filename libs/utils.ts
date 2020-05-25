import * as moment from 'moment';
import { HttpParams } from '@angular/common/http';

export function toUTC(data: string | Date | moment.Moment): moment.Moment {
	return moment(data).utc();
}

export function toLocal(data: string | Date | moment.Moment): moment.Moment {
	return moment.utc(data).local();
}

export function getContrastColor(hex: string) {
	const threshold = 130;
	const hexToRGB = (h) => {
		const hexValue = h.charAt(0) === '#' ? h.substring(1, 7) : h;
		return {
			red: parseInt(hexValue.substring(0, 2), 16),
			blue: parseInt(hexValue.substring(2, 4), 16),
			green: parseInt(hexValue.substring(4, 6), 16),
		};
	};
	const { red, green, blue } = hexToRGB(hex);
	const cBrightness = (red * 299 + green * 587 + blue * 114) / 1000;

	return cBrightness > threshold ? '#000000' : '#ffffff';
}

// It will use when file uploading from angular, just pass object of with file it will convert it to from data
export function toFormData(obj: any, form?: any, namespace?: any) {
	const fd = form || new FormData();
	let formKey;
	for (const property in obj) {
		if (obj.hasOwnProperty(property) && obj[property]) {
			if (namespace) {
				formKey = namespace + '[' + property + ']';
			} else {
				formKey = property;
			}

			// if the property is an object, but not a File, use recursivity.
			if (obj[property] instanceof Date) {
				fd.append(formKey, obj[property].toISOString());
			} else if (
				typeof obj[property] === 'object' &&
				!(obj[property] instanceof File)
			) {
				toFormData(obj[property], fd, formKey);
			} else {
				// if it's a string or a File object
				fd.append(formKey, obj[property]);
			}
		}
	}
	return fd;
}

// It will use for pass nested object or array in query params in get method.
export function toParams(query) {
	let params: HttpParams = new HttpParams();
	Object.keys(query).map((key) => {
		console.log(key, query[key]);
		if (isJsObject(query[key])) {
			params = toSubParams(params, key, query[key]);
		} else {
			params = params.append(key.toString(), query[key]);
		}
	});
	console.log(params);
	return params;
}

function toSubParams(params: HttpParams, key: string, object: any) {
	Object.keys(object).map((childKey) => {
		if (isJsObject(object[childKey])) {
			params = toSubParams(
				params,
				`${key}[${childKey}]`,
				object[childKey]
			);
		} else {
			params = params.append(`${key}[${childKey}]`, object[childKey]);
		}
	});

	return params;
}

export function isJsObject(object: any) {
	const type: string = typeof object;
	return type === 'object';
}
