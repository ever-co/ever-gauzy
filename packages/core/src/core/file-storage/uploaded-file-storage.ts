import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { FileStorage } from './file-storage';

export const UploadedFileStorage = createParamDecorator(
	(data: FileStorageProviderEnum, ctx: ExecutionContext): UploadedFile => {
		try {
			const request = ctx.switchToHttp().getRequest();
			const provider = new FileStorage().getProvider(data);
			return provider.mapUploadedFile(request.file);
		} catch (error) {
			console.log('Error while mapping uploaded file', error);
			throw new BadRequestException(error);
		}
	}
);
