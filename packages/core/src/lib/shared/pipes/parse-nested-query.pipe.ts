import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as qs from 'qs';

@Injectable()
export class ParseNestedQueryPipe implements PipeTransform {
	/**
	 * Parse the query string into a nested object.
	 */
	transform(value: any, metadata: ArgumentMetadata) {
		return qs.parse(value);
	}
}
