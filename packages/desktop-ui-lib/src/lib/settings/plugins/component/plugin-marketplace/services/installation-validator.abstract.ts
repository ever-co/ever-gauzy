import { IPlugin } from '@gauzy/contracts';
import { Observable } from 'rxjs';

/**
 * Context passed through the validation chain
 */
export interface IInstallationValidationContext {
	plugin: IPlugin;
	isUpdate: boolean;
	errors: string[];
	warnings: string[];
	metadata: Record<string, any>;
}

/**
 * Result of a validation step
 */
export interface IValidationStepResult {
	canProceed: boolean;
	error?: string;
	warning?: string;
	metadata?: Record<string, any>;
}

/**
 * Abstract validator in the chain of responsibility
 * Follows Chain of Responsibility Pattern
 * Follows Open/Closed Principle - new validators can be added without changing existing ones
 * Follows Single Responsibility - each validator checks one aspect
 */
export abstract class InstallationValidator {
	protected nextValidator: InstallationValidator | null = null;

	/**
	 * Sets the next validator in the chain
	 * @param validator Next validator
	 * @returns The next validator for fluent chaining
	 */
	setNext(validator: InstallationValidator): InstallationValidator {
		this.nextValidator = validator;
		return validator;
	}

	/**
	 * Validates the installation context
	 * @param context Validation context
	 * @returns Observable with validation result
	 */
	validate(context: IInstallationValidationContext): Observable<IInstallationValidationContext> {
		return new Observable<IInstallationValidationContext>((observer) => {
			let subscription;

			try {
				subscription = this.doValidate(context).subscribe({
					next: (result) => {
						try {
							// Update context with validation result
							if (!result.canProceed) {
								if (result.error) {
									context.errors.push(result.error);
								}
								// Stop chain if cannot proceed
								context.metadata.stoppedAt = this.constructor.name;
								observer.next(context);
								observer.complete();
								return;
							}

							if (result.warning) {
								context.warnings.push(result.warning);
							}

							if (result.metadata) {
								context.metadata = { ...context.metadata, ...result.metadata };
							}

							// Continue to next validator if exists
							if (this.nextValidator) {
								const nextSubscription = this.nextValidator.validate(context).subscribe({
									next: (finalContext) => {
										observer.next(finalContext);
										observer.complete();
									},
									error: (err) => {
										console.error(`[${this.constructor.name}] Chain continuation error:`, err);
										context.errors.push(
											`PLUGIN.VALIDATION.CHAIN_ERROR: ${err?.message || 'Unknown error'}`
										);
										context.metadata.chainError = true;
										observer.next(context);
										observer.complete();
									}
								});

								// Cleanup next validator subscription
								return () => {
									if (nextSubscription) {
										nextSubscription.unsubscribe();
									}
								};
							} else {
								// End of chain - mark completion
								context.metadata.validationCompleted = new Date().toISOString();
								context.metadata.completedAt = this.constructor.name;
								observer.next(context);
								observer.complete();
							}
						} catch (syncError) {
							console.error(`[${this.constructor.name}] Synchronous validation error:`, syncError);
							context.errors.push(
								`PLUGIN.VALIDATION.SYNC_ERROR: ${syncError?.message || 'Unknown error'}`
							);
							context.metadata.syncError = true;
							observer.next(context);
							observer.complete();
						}
					},
					error: (err) => {
						console.error(`[${this.constructor.name}] Validation error:`, err);
						context.errors.push(`PLUGIN.VALIDATION.ERROR: ${err?.message || 'Unknown error'}`);
						context.metadata.asyncError = true;
						observer.next(context);
						observer.complete();
					}
				});
			} catch (error) {
				console.error(`[${this.constructor.name}] Failed to start validation:`, error);
				context.errors.push(`PLUGIN.VALIDATION.START_ERROR: ${error?.message || 'Unknown error'}`);
				context.metadata.startError = true;
				observer.next(context);
				observer.complete();
			}

			// Cleanup on unsubscribe
			return () => {
				if (subscription) {
					subscription.unsubscribe();
				}
			};
		});
	}

	/**
	 * Performs the actual validation logic
	 * To be implemented by concrete validators
	 * @param context Validation context
	 * @returns Observable with step result
	 */
	protected abstract doValidate(context: IInstallationValidationContext): Observable<IValidationStepResult>;
}
