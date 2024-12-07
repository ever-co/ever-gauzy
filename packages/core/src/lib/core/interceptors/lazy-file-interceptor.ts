import { CallHandler, ExecutionContext, Inject, mixin, NestInterceptor, Optional, Type } from '@nestjs/common';
import { MulterModuleOptions } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { MULTER_MODULE_OPTIONS } from '@nestjs/platform-express/multer/files.constants';
import { transformException } from '@nestjs/platform-express/multer/multer/multer.utils';
import * as multer from 'multer';
import { Observable } from 'rxjs';

type MulterInstance = any;

export function LazyFileInterceptor(fieldName: string, localOptions?: MulterOptions): Type<NestInterceptor> {
	class MixinInterceptor implements NestInterceptor {
		protected multer: MulterInstance;

		constructor(
			@Optional()
			@Inject(MULTER_MODULE_OPTIONS)
			private options: MulterModuleOptions = {}
		) {}

		async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
			const ctx = context.switchToHttp();
			const storage = localOptions.storage(context);

			this.multer = (multer as any)({
				...this.options,
				...{
					storage
				}
			});
			await new Promise<void>((resolve, reject) =>
				this.multer.single(fieldName)(ctx.getRequest(), ctx.getResponse(), (err: any) => {
					if (err) {
						const error = transformException(err);
						console.log('Error while uploading file using multer', err);
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
