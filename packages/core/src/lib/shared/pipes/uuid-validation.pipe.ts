// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	ArgumentMetadata,
	Injectable,
	NotAcceptableException,
	NotFoundException,
	PipeTransform
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { isEmpty } from '@gauzy/common';

/**
 * UUID Validation Pipe
 *
 * Validates UUID passed in request parameters.
 */
@Injectable()
export class UUIDValidationPipe implements PipeTransform<string> {
	/**
	* Instance of class-validator
	*
	* Can not be easily injected, and there's no need to do so as we
	* only use it for uuid validation method.
	*/

	/**
	* When user requests an entity with invalid UUID we must return 404
	* error before reaching into the database.
	*/
	public transform(value: string, metadata: ArgumentMetadata): string {
		if (isEmpty(value)) {
			throw new NotFoundException('Validation failed (uuid is expected)');
		}
		if (!isUUID(value)) {
			throw new NotAcceptableException('Validation failed (valid uuid is expected)');
		}
		return value;
	}
}
