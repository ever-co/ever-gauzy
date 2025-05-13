import { HttpParameterCodec } from '@angular/common/http';

/**
 * Custom HttpParamCodec to correctly encode nested query params
 */
export class CustomHttpParamEncoder implements HttpParameterCodec {
	encodeKey(key: string): string {
		return encodeURIComponent(key);
	}

	encodeValue(value: string): string {
		return encodeURIComponent(value);
	}

	decodeKey(key: string): string {
		return decodeURIComponent(key);
	}

	decodeValue(value: string): string {
		return decodeURIComponent(value);
	}
}
