import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FileStorage } from './file-storage';
import { ProviderEnum, UploadedFile } from './models';

export const UploadedFileStorage = createParamDecorator(
	(data: ProviderEnum, ctx: ExecutionContext): UploadedFile => {
		const request = ctx.switchToHttp().getRequest();
		const provider = new FileStorage().getProvider(data);
		return provider.mapUploadedFile(request.file);
	}
);
