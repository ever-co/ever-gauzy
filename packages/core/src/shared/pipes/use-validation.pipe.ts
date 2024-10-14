import { UsePipes, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * Creates and applies a custom validation pipe with optional configuration.
 *
 * This function is a helper for applying NestJS's `ValidationPipe` with custom options
 * to a route or controller. It wraps the `UsePipes` decorator and makes it easier to
 * customize validation behavior.
 *
 * @param options - Optional `ValidationPipeOptions` to customize the validation behavior.
 * @returns A decorator that applies the `ValidationPipe` with the given options.
 */
export function UseValidationPipe(options?: Partial<ValidationPipeOptions>) {
	return UsePipes(new ValidationPipe(options ?? {}));
}
