import { IPlugin } from '@gauzy/contracts';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

/**
 * Context passed through the validation chain
 */
export interface IInstallationValidationContext {
	plugin: IPlugin;
	isUpdate: boolean;
	errors: string[];
	warnings: string[];
	metadata: Record<string, unknown>;
}

/**
 * Result of a validation step
 */
export interface IValidationStepResult {
	canProceed: boolean;
	error?: string;
	warning?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Abstract validator implementing Chain of Responsibility pattern
 */
export abstract class InstallationValidator {
	protected next: InstallationValidator | null = null;

	setNext(validator: InstallationValidator): InstallationValidator {
		this.next = validator;
		return validator;
	}

	validate(context: IInstallationValidationContext): Observable<IInstallationValidationContext> {
		return this.doValidate(context).pipe(
			map((result) => this.applyResult(context, result)),
			switchMap(([ctx, canProceed]) => (canProceed ? this.proceed(ctx) : of(ctx))),
			catchError((err) => this.fail(context, 'ERROR', err))
		);
	}

	private applyResult(
		context: IInstallationValidationContext,
		{ canProceed, error, warning, metadata }: IValidationStepResult
	): [IInstallationValidationContext, boolean] {
		if (!canProceed && error) {
			context.errors.push(error);
			context.metadata.stoppedAt = this.constructor.name;
		}
		if (warning) context.warnings.push(warning);
		if (metadata) Object.assign(context.metadata, metadata);
		return [context, canProceed];
	}

	private proceed(context: IInstallationValidationContext): Observable<IInstallationValidationContext> {
		if (!this.next) {
			context.metadata.validationCompleted = new Date().toISOString();
			context.metadata.completedAt = this.constructor.name;
			return of(context);
		}
		return this.next.validate(context).pipe(catchError((err) => this.fail(context, 'CHAIN_ERROR', err)));
	}

	private fail(
		context: IInstallationValidationContext,
		type: string,
		err: Error
	): Observable<IInstallationValidationContext> {
		context.errors.push(`PLUGIN.VALIDATION.${type}: ${err?.message ?? 'Unknown error'}`);
		context.metadata[`${type.toLowerCase()}Error`] = true;
		return of(context);
	}

	protected abstract doValidate(context: IInstallationValidationContext): Observable<IValidationStepResult>;
}
