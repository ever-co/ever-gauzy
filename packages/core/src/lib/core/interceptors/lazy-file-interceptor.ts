import {
	CallHandler,
	ExecutionContext,
	Inject,
	Logger,
	mixin,
	NestInterceptor,
	Optional,
	Type
} from '@nestjs/common';
import { MulterModuleOptions } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { MULTER_MODULE_OPTIONS } from '@nestjs/platform-express/multer/files.constants';
import { transformException } from '@nestjs/platform-express/multer/multer/multer.utils';
import * as multer from 'multer';
import { Observable } from 'rxjs';

type MulterInstance = any;

/**
 * Options for {@link LazyFileInterceptor}.
 *
 * `storage` is a FACTORY, not a `StorageEngine` — that is the whole point of this interceptor, which
 * resolves the destination per request (tenant folder, provider, …) rather than once at module load.
 * It is REQUIRED and typed as such: `MulterOptions.storage` is `any`, so the previous signature both
 * accepted a caller that omitted it and accepted one that passed an engine instead of a factory.
 * Either mistake compiles and then throws a TypeError on the first upload — the route answers 500
 * with nothing pointing at the cause. That is not hypothetical: it shipped on the chat's dictation
 * endpoint and broke every attempt to use it.
 */
export type LazyFileInterceptorOptions = Omit<MulterOptions, 'storage'> & {
	storage: (context: ExecutionContext) => multer.StorageEngine;
};

export function LazyFileInterceptor(fieldName: string, localOptions: LazyFileInterceptorOptions): Type<NestInterceptor> {
	class MixinInterceptor implements NestInterceptor {
		protected multer: MulterInstance;
		private readonly logger = new Logger('LazyFileInterceptor');

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
					storage,
					// No optional chaining on `localOptions` here: it is a REQUIRED parameter (the call
					// above already dereferences it), and a `?.` would imply otherwise — DeepScan rightly
					// flags the inconsistency (INSUFFICIENT_NULL_CHECK).
					//
					// Pass through a per-route fileFilter when provided (e.g. to block executable/SVG uploads).
					...(localOptions.fileFilter ? { fileFilter: localOptions.fileFilter } : {}),
					// …and `limits` likewise. Dropping it was the same silent-no-op trap as the missing
					// storage factory, one step further along: a route declaring `limits: { fileSize }`
					// read as capped while accepting uploads of any size, and nothing failed to say so.
					// No caller relies on the old behaviour — none currently declare `limits` — so this
					// only changes what happens the next time someone reasonably expects it to work.
					...(localOptions.limits ? { limits: localOptions.limits } : {})
				}
			});
			await new Promise<void>((resolve, reject) =>
				this.multer.single(fieldName)(ctx.getRequest(), ctx.getResponse(), (err: any) => {
					if (err) {
						const error = transformException(err);
						this.logger.error('Error while uploading file using multer', err?.stack ?? String(err));
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
