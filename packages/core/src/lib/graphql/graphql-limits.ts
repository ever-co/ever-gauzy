import { GraphQLError } from 'graphql';
import type { ASTVisitor, ValidationContext, ValidationRule } from 'graphql';
import type { ApolloServerPlugin } from '@apollo/server';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { measureOperation } from './graphql-cost';
import type { IGraphqlPolicy } from './graphql-policy';

/**
 * The four ceilings, applied to the document before a resolver runs.
 *
 * These are graphql-js validation rules rather than a plugin, and that is a decision about
 * guarantees: a rule is part of validating the request, so it holds in a deployment that configures
 * no Apollo plugin of its own. A plugin would have made the ceilings part of the deployment's own
 * attach point, and the deployment that forgets to attach one is precisely the one that needs them.
 *
 * Depth and cost are measured on the operation's shape — see `graphql-cost.ts` for the published
 * model — aliases are counted because an alias multiplies the work of one field without changing
 * the document's depth, and introspection is refused by name when the policy says the deployment
 * does not publish its schema.
 */

/** The fields that describe the schema rather than the data. */
const INTROSPECTION_FIELDS = ['__schema', '__type'];

/**
 * Refuses a selection set deeper than the ceiling.
 *
 * @param maxDepth The ceiling.
 * @returns The rule.
 */
export function createDepthLimitRule(maxDepth: number): ValidationRule {
	return (context: ValidationContext): ASTVisitor => ({
		OperationDefinition: {
			leave(node) {
				const measured = measureOperation(node as any);

				if (measured.depth > maxDepth) {
					context.reportError(
						limitError(
							`The query is ${measured.depth} levels deep and this deployment allows ${maxDepth}.`,
							ApiErrorCode.GRAPHQL_DEPTH_LIMIT_EXCEEDED,
							{ limit: maxDepth, actual: measured.depth, kind: 'depth' },
							node as any
						)
					);
				}
			}
		}
	});
}

/**
 * Refuses an operation that costs more than the ceiling.
 *
 * @param maxComplexity The ceiling, in the cost model's points.
 * @returns The rule.
 */
export function createComplexityLimitRule(maxComplexity: number): ValidationRule {
	return (context: ValidationContext): ASTVisitor => ({
		OperationDefinition: {
			leave(node) {
				const measured = measureOperation(node as any);

				if (measured.complexity > maxComplexity) {
					context.reportError(
						limitError(
							`The query costs ${measured.complexity} and this deployment allows ${maxComplexity}. Reduce the page size or the number of fields selected.`,
							ApiErrorCode.GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED,
							{ limit: maxComplexity, actual: measured.complexity, kind: 'complexity' },
							node as any
						)
					);
				}
			}
		}
	});
}

/**
 * Refuses an operation that aliases more fields than the ceiling.
 *
 * An alias is how one field becomes fifty: the same expensive resolver, written once per alias in a
 * single round trip. Depth says nothing about it and cost alone would price it as fifty fields —
 * true, but only after the database has been asked fifty times, which is what the separate, much
 * smaller ceiling exists to stop.
 *
 * @param maxAliases The ceiling.
 * @returns The rule.
 */
export function createAliasLimitRule(maxAliases: number): ValidationRule {
	return (context: ValidationContext): ASTVisitor => ({
		OperationDefinition: {
			leave(node) {
				const measured = measureOperation(node as any);

				if (measured.aliases > maxAliases) {
					context.reportError(
						limitError(
							`The query uses ${measured.aliases} aliases and this deployment allows ${maxAliases}.`,
							ApiErrorCode.GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED,
							{ limit: maxAliases, actual: measured.aliases, kind: 'aliases' },
							node as any
						)
					);
				}
			}
		}
	});
}

/**
 * Refuses an operation that asks for the schema when the deployment does not publish it.
 *
 * The refusal is a validation error on the field, so the caller is told which part of the query was
 * not allowed rather than receiving an empty object. `__typename` is deliberately not refused: it
 * names the type of a value the caller is already allowed to read, and it is what a generated client
 * needs to resolve a union.
 *
 * @param enabled Whether introspection is published.
 * @returns The rule, or undefined when introspection is on.
 */
export function createIntrospectionRule(enabled: boolean): ValidationRule | undefined {
	if (enabled) {
		return undefined;
	}

	return (context: ValidationContext): ASTVisitor => ({
		Field(node) {
			const name = node.name?.value;

			if (name && INTROSPECTION_FIELDS.includes(name)) {
				context.reportError(
					limitError(
						`Schema introspection is not enabled on this deployment, so ${name} cannot be queried.`,
						ApiErrorCode.GRAPHQL_INTROSPECTION_DISABLED,
						{ field: name },
						node as any
					)
				);
			}
		}
	});
}

/**
 * The rules a policy produces.
 *
 * Order matters for what a client sees first: the introspection refusal is checked before the size
 * ceilings, because a caller probing the schema should be told that introspection is off rather than
 * that its probe happened to be too deep.
 *
 * @param policy The resolved policy.
 * @returns The validation rules to install.
 */
export function createGraphqlLimitRules(
	policy: Pick<IGraphqlPolicy, 'maxDepth' | 'maxComplexity' | 'maxAliases' | 'introspection'>
): ValidationRule[] {
	return [
		createIntrospectionRule(policy.introspection),
		createDepthLimitRule(policy.maxDepth),
		createComplexityLimitRule(policy.maxComplexity),
		createAliasLimitRule(policy.maxAliases)
	].filter((rule): rule is ValidationRule => typeof rule === 'function');
}

/**
 * Refuses an HTTP request that carries more operations than the ceiling.
 *
 * A batch is several operations in one body, and every ceiling above is measured per operation, so
 * this is the one limit a validation rule cannot express: the rule sees one document, not the batch
 * it arrived in. It rides the plugin array — installed by the platform rather than by the
 * deployment, so it holds in a deployment that configures no plugin of its own — and it is
 * deliberately tolerant: if the transport does not expose the request body, the operation proceeds
 * and the per-operation ceilings still apply.
 *
 * @param maxBatchSize The ceiling.
 * @returns The plugin.
 */
export function createBatchLimitPlugin(maxBatchSize: number): ApolloServerPlugin {
	return {
		async requestDidStart() {
			return {
				async didResolveOperation(requestContext: { request?: { http?: { body?: unknown } } }) {
					const body = requestContext?.request?.http?.body;

					if (!Array.isArray(body) || body.length <= maxBatchSize) {
						return;
					}

					throw limitError(
						`This request carries ${body.length} operations and this deployment allows ${maxBatchSize} per request.`,
						ApiErrorCode.GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED,
						{ limit: maxBatchSize, actual: body.length, kind: 'batch' }
					);
				}
			};
		}
	};
}

/**
 * Builds the error a refused query is answered with.
 *
 * The code travels in `extensions`, which is where a GraphQL client reads a machine-readable answer,
 * and the HTTP status travels with it so a transport that honours it answers `400` rather than `200`
 * — a limit refusal is a request the caller could have written correctly, and there is nothing to
 * retry.
 *
 * @param message The message, written for the caller.
 * @param code The catalogued code.
 * @param details What the limit was and what the query measured.
 * @param node The offending node, when there is one, so the error carries a location.
 * @returns The error to report.
 */
function limitError(
	message: string,
	code: ApiErrorCode,
	details: Record<string, unknown>,
	node?: unknown
): GraphQLError {
	return new GraphQLError(message, {
		...(node ? { nodes: node as any } : {}),
		extensions: {
			code,
			status: 400,
			details
		}
	});
}
