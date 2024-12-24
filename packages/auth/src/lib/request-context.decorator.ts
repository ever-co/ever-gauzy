import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface IObject {
	[key: string]: any;
}

export interface IIncomingRequest {
	body: IObject;
	params: IObject;
	query: IObject;
	headers: IObject;
	req?: any;
	user?: any;
}

/**
 * RequestCtx decorator to extract and structure information from the HTTP request.
 */
export const RequestCtx = createParamDecorator(
	async (
		data: unknown,
		ctx: ExecutionContext
	): Promise<IIncomingRequest | void> => {
		// Extract the 'req' object from the current execution context.
		const req = ctx.switchToHttp().getRequest();

		// Extract information from the 'req' object.
		const body = req.body;
		const headers = req.headers;
		const params = req.params;
		const query = req.query;
		const user = req.user;

		// Structure the extracted information into an IIncomingRequest object.
		const result: IIncomingRequest = {
			body,
			headers,
			params,
			query,
			user
		};

		// Return the structured result.
		return result;
	}
);
