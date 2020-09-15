import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UploadedFileStorage = createParamDecorator(
	(data: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest();
		const file = request.file;
		if (!request.file.filename) {
			file.filename = file.originalname;
		}

		return file;
	}
);
