import { Injectable } from '@angular/core';

@Injectable()
export class JitsuLoaderService {
	constructor() {}

	load(host: string, writeKey: string) {
		try {
			return {
				host: host,
				writeKey: writeKey,
			};
		} catch (error) {
			return null;
		}
	}
}
