import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FileStorage } from './file-storage';
import { FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';

export const UploadedFileStorage = createParamDecorator(
	(data: FileStorageProviderEnum, ctx: ExecutionContext): UploadedFile => {
		const request = ctx.switchToHttp().getRequest();
		const provider = new FileStorage().getProvider(data);
		return provider.mapUploadedFile(request.file);
	}
);
