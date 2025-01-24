import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';

/**
 * Decorator that assigns metadata to the class/function using the
 * specified `PUBLIC_METHOD_METADATA`.
 * *
 * This metadata can be reflected using the `Reflector` class.
 *
 * Example: `@Public()`
 *
 *
 * @publicApi
 */
export const Public = (): CustomDecorator => SetMetadata(PUBLIC_METHOD_METADATA, true);
