import { UsePipes, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

export function UseValidationPipe(options?: Partial<ValidationPipeOptions>) {
	return UsePipes(new ValidationPipe(options));
}
