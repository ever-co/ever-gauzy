/**
 * What the register form can tell a person whose sign-up the API refused.
 *
 * Every register error used to become "Something went wrong, please try again." That hid the one
 * refusal people can act on: on a deployment that sells subscriptions (app.gauzy.co), the API answers
 * 403 with `{ message: 'A subscription is required…', checkoutUrl }` for an email with no paid plan.
 * Retrying cannot help that person; going to the checkout can.
 */
export interface IRegisterErrorDetails {
	/** Messages the API wrote for people, or null when the error carries none (then keep the default). */
	messages: string[] | null;
	/** Where to buy a subscription, when the API sent one; always an absolute http(s) URL. */
	checkoutUrl: string | null;
}

/**
 * Reads the user-facing parts of a failed register request.
 *
 * Only 4xx answers are read: the API writes those messages for people (validation, "already
 * registered", "subscription required"), whereas a 5xx body can carry internal detail. A missing,
 * relative or non-http(s) `checkoutUrl` is dropped, so a malformed answer can never produce a
 * `javascript:` link.
 *
 * @param error Whatever the register request failed with (usually an `HttpErrorResponse`).
 */
export function readRegisterError(error: unknown): IRegisterErrorDetails {
	const details: IRegisterErrorDetails = { messages: null, checkoutUrl: null };
	if (!error || typeof error !== 'object') {
		return details;
	}

	const { status, error: body } = error as { status?: unknown; error?: unknown };
	if (typeof status !== 'number' || status < 400 || status >= 500 || !body || typeof body !== 'object') {
		return details;
	}

	const { message, checkoutUrl } = body as { message?: unknown; checkoutUrl?: unknown };
	const messages = (Array.isArray(message) ? message : [message]).filter(
		(item): item is string => typeof item === 'string' && item.trim().length > 0
	);
	if (messages.length) {
		details.messages = messages.map((item) => item.trim());
	}

	details.checkoutUrl = toHttpUrl(checkoutUrl);
	return details;
}

/** The value as an absolute http(s) URL string, or null. */
function toHttpUrl(value: unknown): string | null {
	if (typeof value !== 'string' || !value.trim()) {
		return null;
	}
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
	} catch {
		return null;
	}
}
