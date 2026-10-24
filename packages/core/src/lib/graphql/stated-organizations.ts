import { GraphQLArgument, GraphQLInputType, isInputObjectType, isListType, isNonNullType } from 'graphql';

/** The filter operators that SELECT an organization (`IDFilter.eq` / `.in`); `ne` excludes one, so it names none. */
const SELECTING_OPERATORS = ['eq', 'in'];

/** What the walk found: the organizations an operation names, and whether it named one in a shape REST refuses. */
export interface IStatedOrganizations {
	ids: Set<string>;
	/** A member the REST validator answers `false` to without a lookup: a non-string id. */
	malformed: boolean;
}

/**
 * Every organization an operation's arguments name, read through the field's own argument types.
 *
 * The REST rule this mirrors is `@IsOrganizationBelongsToUser()` (GHSA-44pv-34gx-q9p4) on the `organizationId` of
 * `TenantOrganizationBaseDTO`: an empty value passes, a string must be one of the caller's organizations, anything
 * else fails. GraphQL runs no class-validator on its arguments, so the rule is applied here to every argument or
 * input member the SCHEMA declares as `organizationId` — top-level arguments, inputs, nested inputs, lists — and to
 * the `eq` / `in` selectors of an `IDFilter` on `organizationId`, which select the named organization's rows exactly
 * as a stated id does. The walk follows the declared input types, so a `JSON` argument (a template preview, a
 * metadata blob) is opaque to it, as class-validator's `whitelist` DTOs never reached inside one either.
 *
 * @param args - The operation's argument values.
 * @param definitions - The field's argument definitions.
 * @returns The organization ids named, and whether a member was malformed.
 */
export function statedOrganizations(
	args: Record<string, unknown>,
	definitions: readonly GraphQLArgument[]
): IStatedOrganizations {
	let found: IStatedOrganizations = { ids: new Set<string>(), malformed: false };

	const stateId = (value: unknown): void => {
		if (value === null || value === undefined || value === '') return;
		if (typeof value === 'string') {
			found.ids.add(value);
			return;
		}
		if (typeof value === 'object' && !Array.isArray(value)) {
			// An `IDFilter`: its selecting operators name organizations; `ne` names none.
			for (const operator of SELECTING_OPERATORS) {
				const operand = (value as Record<string, unknown>)[operator];
				const operands = Array.isArray(operand)
					? operand
					: operand === undefined || operand === null
						? []
						: [operand];
				for (const id of operands) {
					if (typeof id === 'string' && id.length > 0) found.ids.add(id);
					else found.malformed = true;
				}
			}
			return;
		}
		found.malformed = true;
	};

	const visit = (value: unknown, type: GraphQLInputType): void => {
		if (value === null || value === undefined) return;
		const unwrapped = isNonNullType(type) ? type.ofType : type;
		if (isListType(unwrapped)) {
			for (const item of Array.isArray(value) ? value : [value]) visit(item, unwrapped.ofType);
			return;
		}
		if (!isInputObjectType(unwrapped) || typeof value !== 'object') return;
		const fields = unwrapped.getFields();
		for (const [name, member] of Object.entries(value as Record<string, unknown>)) {
			const field = fields[name];
			if (!field) continue;
			if (name === 'organizationId') stateId(member);
			else visit(member, field.type);
		}
	};

	for (const definition of definitions ?? []) {
		const value = args?.[definition.name];
		if (definition.name === 'organizationId') stateId(value);
		else visit(value, definition.type);
	}

	return found;
}
