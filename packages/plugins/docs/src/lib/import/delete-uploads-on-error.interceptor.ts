import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
import { FileStorage } from '@gauzy/core';

/**
 * Deletes the files the upload interceptor stored when the request then fails — a body the validation pipe refuses, a
 * guard or a handler error. The upload interceptor stores before validation runs, and a refused request creates no row
 * that could name the blob later, so without this every refused import would leave its zip in storage for good.
 *
 * Declared AFTER the upload interceptor on the route: it wraps the pipes and the handler, not the upload.
 */
@Injectable()
export class DeleteUploadsOnErrorInterceptor implements NestInterceptor {
	private readonly logger = new Logger(DeleteUploadsOnErrorInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest();
		return next.handle().pipe(catchError((error: unknown) => from(this.discard(request)).pipe(switchMap(() => throwError(() => error)))));
	}

	/** Deletes every stored file of the request, best-effort (a file the handler already deleted is gone). */
	private async discard(request: { files?: unknown[] } | undefined): Promise<void> {
		const files = Array.isArray(request?.files) ? request.files : [];
		if (!files.length) return;
		const provider = new FileStorage().getProvider();
		for (const file of files) {
			try {
				const mapped = await provider.mapUploadedFile(file as never);
				if (mapped?.key) await provider.deleteFile(mapped.key);
			} catch (error) {
				this.logger.debug?.(`A refused upload could not be deleted: ${(error as Error)?.message ?? error}`);
			}
		}
	}
}
