import { CallHandler, ExecutionContext, Inject, Logger, mixin, NestInterceptor, Optional, Type } from '@nestjs/common';
import { MulterModuleOptions } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { MULTER_MODULE_OPTIONS } from '@nestjs/platform-express/multer/files.constants';
import { transformException } from '@nestjs/platform-express/multer/multer/multer.utils';
import * as multer from 'multer';
import { Observable } from 'rxjs';

/**
 * Multi-file (≤ N) variant of the core `LazyFileInterceptor` (videos-plugin precedent):
 * the storage engine is constructed lazily **per request** so it sees `RequestContext`
 * (tenant scoping in the generated keys), then multer's `.array(fieldName, maxCount)`
 * runs the upload.
 *
 * @param fieldName The multipart field carrying the files (`files`).
 * @param maxCount Maximum number of files per request.
 * @param localOptions Multer options; `storage` is a per-request factory.
 */
export function LazyFilesInterceptor(
	fieldName: string,
	maxCount: number,
	localOptions?: MulterOptions
): Type<NestInterceptor> {
	class MixinInterceptor implements NestInterceptor {
		/** The multer instance built per request (the storage engine is resolved lazily). */
		protected multer: any;
		private readonly logger = new Logger('LazyFilesInterceptor');

		constructor(
			@Optional()
			@Inject(MULTER_MODULE_OPTIONS)
			private readonly options: MulterModuleOptions = {}
		) {}

		async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
			const ctx = context.switchToHttp();
			// The storage option is a per-request factory (core LazyFileInterceptor precedent).
			const storage = typeof localOptions?.storage === 'function' ? (localOptions.storage as any)(context) : undefined;

			this.multer = (multer as any)({
				...this.options,
				...(storage ? { storage } : {}),
				...(localOptions?.limits ? { limits: localOptions.limits } : {}),
				...(localOptions?.fileFilter ? { fileFilter: localOptions.fileFilter } : {})
			});

			await new Promise<void>((resolve, reject) =>
				this.multer.array(fieldName, maxCount)(ctx.getRequest(), ctx.getResponse(), (err: any) => {
					if (err) {
						const error = transformException(err);
						this.logger.error('Error while uploading files using multer', err?.stack ?? String(err));
						return reject(error);
					}
					resolve();
				})
			);
			return next.handle();
		}
	}
	const Interceptor = mixin(MixinInterceptor);
	return Interceptor;
}
