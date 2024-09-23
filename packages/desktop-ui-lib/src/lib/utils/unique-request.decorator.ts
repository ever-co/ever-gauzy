import hash from 'hash-it';

export function UniqueRequest() {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		const pendingRequests = new Set<string>();

		descriptor.value = async function (...args: any[]) {
			const requestId = hash(args).toString();

			if (pendingRequests.has(requestId)) {
				console.warn(`Duplicate request detected: ID: ${requestId}`);
				return null;
			}

			pendingRequests.add(requestId);

			try {
				const result = await originalMethod.apply(this, args);
				return result;
			} catch (error) {
				throw error;
			} finally {
				pendingRequests.delete(requestId);
			}
		};

		return descriptor;
	};
}
