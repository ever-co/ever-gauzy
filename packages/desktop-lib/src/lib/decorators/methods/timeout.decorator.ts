import moment from 'moment';

/**
 * Decorator function for adding timeout functionality to methods.
 * @param milliseconds Timeout duration in milliseconds.
 */
export function Timeout(milliseconds: number): MethodDecorator {
	return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = async function (...args: any[]) {
			// Create a promise that rejects after the specified timeout duration
			let timeoutId = null;
			const timeoutPromise = new Promise<void>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(new Error(`Timeout: Operation took longer than ${moment.duration(milliseconds, 'milliseconds').humanize()}.`));
				}, milliseconds);
			});

			// Call the original method with the provided arguments
			const originalPromise = originalMethod.apply(this, args);

			try {
				// Wait for either the original method or the timeout to complete
				await Promise.race([timeoutPromise, originalPromise]);
				// clear timeout
				clearTimeout(timeoutId);
			} catch (error) {
				// If an error occurs, rethrow it
				throw error;
			}
		};

		return descriptor;
	};
}
