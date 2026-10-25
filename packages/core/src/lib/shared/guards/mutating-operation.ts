import { ContextType, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/** The HTTP methods that only read. */
const READ_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Whether an operation writes: a GraphQL mutation, or an HTTP request with any method but GET, HEAD and OPTIONS (an
 * unknown method counts as a write).
 *
 * A third-party OAuth-app token without a write scope may not run one, whatever permissions the route declares:
 * several write routes also accept a read permission (`POST /timesheet/time-slot` admits `ALL_ORG_VIEW`, the email
 * template writes declare `VIEW_ALL_EMAIL_TEMPLATES`), so narrowing the declared permissions alone would let a
 * read-only app write through them (owner decision Q12, see `auth/oauth-app-scope.ts`).
 *
 * @param context The execution context.
 * @returns True for a write.
 */
export function isMutatingOperation(context: ExecutionContext): boolean {
	if (context.getType<ContextType | 'graphql'>() === 'graphql') {
		return GqlExecutionContext.create(context).getInfo()?.operation?.operation === 'mutation';
	}

	const method = context.switchToHttp().getRequest()?.method;
	return !READ_METHODS.has(String(method ?? '').toUpperCase());
}
