import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ValidationArguments } from 'class-validator';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLArgument, GraphQLInputType, GraphQLResolveInfo, isInputObjectType, isListType, isNonNullType } from 'graphql';
import { Observable } from 'rxjs';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { RequestContext } from '../core/context';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';
import { EmployeeBelongsToOrganizationConstraint } from '../shared/validators/constraints/employee-belongs-to-organization.constraint';

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
export function statedOrganizations(args: Record<string, unknown>, definitions: readonly GraphQLArgument[]): IStatedOrganizations {
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
				const operands = Array.isArray(operand) ? operand : operand === undefined || operand === null ? [] : [operand];
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

/** One employee an operation names, with the organization stated beside it. */
export interface IStatedEmployee {
	employeeId: string;
	organizationId: string;
}

/**
 * Every employee an operation names beside an organization, read through the field's declared argument types.
 *
 * The REST rule this mirrors is `@IsEmployeeBelongsToOrganization()` (SEC-A-08): an `employeeId` — and here
 * `employeeIds` too — must be an employee of the organization stated in the SAME object, and nothing is checked
 * where no organization is stated beside it (the REST validator is permissive there, for organization-level
 * records). Only stated ids are read: a filter's `{ eq }` names no employee to write.
 *
 * @param args The operation's arguments.
 * @param definitions The field's declared arguments.
 * @returns The employee / organization pairs to check.
 */
export function statedEmployees(args: Record<string, unknown>, definitions: readonly GraphQLArgument[]): IStatedEmployee[] {
	const found: IStatedEmployee[] = [];

	const examine = (object: Record<string, unknown>, members: Record<string, { type: GraphQLInputType }>): void => {
		const organizationId = object['organizationId'];

		if (typeof organizationId === 'string' && organizationId.length > 0) {
			const named: unknown[] = [];
			if ('employeeId' in members) named.push(object['employeeId']);
			if ('employeeIds' in members) {
				const ids = object['employeeIds'];
				named.push(...(Array.isArray(ids) ? ids : [ids]));
			}
			for (const employeeId of named) {
				if (typeof employeeId === 'string' && employeeId.length > 0) found.push({ employeeId, organizationId });
			}
		}

		for (const [name, member] of Object.entries(object)) {
			const field = members[name];
			if (!field || name === 'employeeId' || name === 'employeeIds' || name === 'organizationId') continue;
			visit(member, field.type);
		}
	};

	const visit = (value: unknown, type: GraphQLInputType): void => {
		if (value === null || value === undefined) return;
		const unwrapped = isNonNullType(type) ? type.ofType : type;
		if (isListType(unwrapped)) {
			for (const item of Array.isArray(value) ? value : [value]) visit(item, unwrapped.ofType);
			return;
		}
		if (!isInputObjectType(unwrapped) || typeof value !== 'object') return;
		examine(value as Record<string, unknown>, unwrapped.getFields());
	};

	examine(args ?? {}, Object.fromEntries((definitions ?? []).map((definition) => [definition.name, definition])));

	return found;
}

/**
 * R7-03 (P0, security review of #10254): the organization-membership rule of the REST surface, on GraphQL.
 *
 * REST refuses an `organizationId` the caller does not belong to through `@IsOrganizationBelongsToUser()` on its
 * DTOs (GHSA-44pv-34gx-q9p4). GraphQL runs no class-validator on resolver arguments — there is no `ValidationPipe`
 * on any `@Args` and none globally — so every one of the ~450 root fields that take an `organizationId` let a member
 * of organization A read or write organization B of the same tenant (payroll, expenses, …): the services scope by the
 * tenant and by the *stated* organization only.
 *
 * One kernel rule rather than 450 resolver edits: before any GraphQL query, mutation or subscription resolves, every
 * organization its arguments name (see {@link statedOrganizations}) must be one the caller belongs to — the SAME lookup
 * the REST validator makes (`OrganizationBelongsToUserConstraint.checkOrganizationExistence`: a `user_organization`
 * row for the caller's tenant, user and that organization; no bypass, exactly as REST has none). A refusal is the
 * REST answer's equivalent: a 400 validation failure naming the field.
 *
 * Fields marked `@Public()` are not checked, as their REST twins never run the validator (it fails closed without a
 * user); `graphql-organization-membership-check.mjs` lists every public field that takes an organization, so a new
 * one is reviewed rather than silently exempt. It runs after every guard (an interceptor), so authentication, the
 * tenant and the permission checks have already passed and the request context is the caller's.
 */
@Injectable()
export class GraphqlOrganizationMembershipInterceptor implements NestInterceptor {
	constructor(
		private readonly reflector: Reflector,
		private readonly organizationMembership: OrganizationBelongsToUserConstraint,
		private readonly employeeMembership: EmployeeBelongsToOrganizationConstraint
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
		if (context.getType<GqlContextType>() !== 'graphql') {
			return next.handle();
		}

		const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METHOD_METADATA, [
			context.getHandler(),
			context.getClass()
		]);
		if (isPublic) {
			return next.handle();
		}

		const graphql = GqlExecutionContext.create(context);
		const info = graphql.getInfo<GraphQLResolveInfo>();
		const definition = info?.parentType?.getFields?.()[info.fieldName];
		const { ids, malformed } = statedOrganizations(graphql.getArgs(), definition?.args ?? []);
		if (malformed) {
			throw this.refusal();
		}
		for (const organizationId of ids) {
			if (!(await this.organizationMembership.checkOrganizationExistence(organizationId))) {
				throw this.refusal();
			}
		}
		// The employee rule, after the organization is known to be the caller's (SEC-A-08): the REST validator's own
		// check, handed the organization the same object states.
		for (const { employeeId, organizationId } of statedEmployees(graphql.getArgs(), definition?.args ?? [])) {
			const belongs = await this.employeeMembership.validate(employeeId, { object: { organizationId } } as ValidationArguments);
			if (!belongs) {
				throw this.employeeRefusal(employeeId);
			}
		}

		return next.handle();
	}

	/** The REST employee validator's answer, in this surface's vocabulary. */
	private employeeRefusal(employeeId: string): ApiException {
		return new ApiException(
			400,
			ApiErrorCode.VALIDATION_FAILED,
			`This employee (${JSON.stringify(employeeId)}) does not belong to the specified organization.`,
			{ field: 'employeeId' }
		);
	}

	/** The REST validator's answer, in this surface's vocabulary. */
	private refusal(): ApiException {
		return new ApiException(
			400,
			ApiErrorCode.VALIDATION_FAILED,
			`The user with ID ${RequestContext.currentUserId()} is not associated with the specified organization.`,
			{ field: 'organizationId' }
		);
	}
}
