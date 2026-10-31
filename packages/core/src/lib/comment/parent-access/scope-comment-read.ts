import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { And, Equal, FindOperator, In, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';

/** A governed record a comment read names, which the caller must be allowed to read. */
export interface ICommentParentRef {
	entity: string;
	entityId: ID;
}

/** A comment read's criteria once they have been kept to what the policies allow. */
export interface ICommentReadScope<W> {
	/** The criteria to run: the caller's own object when nothing had to change. */
	where: W | W[] | undefined;
	/** The governed records the criteria name, each once. */
	parents: ICommentParentRef[];
	/** True when every alternative of the criteria names one governed record. */
	onlyGovernedParents: boolean;
}

/**
 * Keeps a comment read's criteria to the comments a caller may list.
 *
 * Each alternative of the criteria (a `where` object, or each object of a `where` list) either names one governed
 * record — `{ entity: <governed type>, entityId: <uuid> }`, whose read the caller must then be allowed — or is
 * narrowed to the comments of non-governed records, by adding `entity NOT IN (<governed types>)` beside whatever it
 * already says about `entity`. The exclusion is stated even beside a plain non-governed `entity` value: the
 * database compares the column with its own collation (case-, accent- and trailing-space-insensitive on MySQL), so
 * only the database can tell that a spelling does not reach a governed type. For a non-governed type the added
 * condition is always true, so those reads return exactly what they returned before.
 *
 * With no governed types the criteria are returned as they are.
 *
 * `governedTypeOf` says which governed type a stated `entity` names. By default only the exact spelling does; the
 * comment service passes the policy registry's own answer, under which a database's other spellings of a governed
 * type (`organizationcontact`) name it too, so such an alternative is checked as that record's read.
 *
 * @throws {BadRequestException} When an alternative names a governed type without one record id, or when the
 *         criteria are not objects or state `entity` as something other than text or a find operator.
 */
export function scopeCommentReadToParents<W extends object>(
	where: W | W[] | undefined | null,
	governed: ReadonlyArray<string>,
	governedTypeOf: (entity: string) => string | undefined = (entity) =>
		governed.includes(entity) ? entity : undefined
): ICommentReadScope<W> {
	if (governed.length === 0) {
		return { where: where ?? undefined, parents: [], onlyGovernedParents: false };
	}
	if (where != null && typeof where !== 'object') {
		throw new BadRequestException('Comment criteria must be an object or a list of objects.');
	}

	// An empty list is read by the CRUD base as "no criteria", like an absent one.
	const list = Array.isArray(where);
	const alternatives: unknown[] =
		where == null ? [{}] : list ? ((where as W[]).length ? (where as W[]) : [{}]) : [where];

	const parents = new Map<string, ICommentParentRef>();
	let onlyGovernedParents = true;
	const scoped = alternatives.map((alternative) => {
		if (
			alternative === null ||
			typeof alternative !== 'object' ||
			Array.isArray(alternative) ||
			alternative instanceof FindOperator
		) {
			throw new BadRequestException('Comment criteria must be an object or a list of objects.');
		}
		const { entity, entityId } = alternative as Record<string, unknown>;

		const governedType = typeof entity === 'string' ? governedTypeOf(entity) : undefined;
		if (governedType) {
			if (typeof entityId !== 'string' || !isUUID(entityId)) {
				throw new BadRequestException(
					`The comments of a ${governedType} are read one record at a time: state its entityId.`
				);
			}
			parents.set(`${governedType}:${entityId}`, { entity: governedType, entityId });
			return alternative as W;
		}

		onlyGovernedParents = false;
		return { ...(alternative as W), entity: outsideGoverned(entity, governed) } as W;
	});

	return {
		where: list ? scoped : scoped[0],
		parents: [...parents.values()],
		onlyGovernedParents
	};
}

/** `entity` as the caller stated it, and not one of the governed types. */
function outsideGoverned(stated: unknown, governed: ReadonlyArray<string>): FindOperator<string> {
	const outside = Not(In([...governed]));
	if (stated === undefined || stated === null) {
		return outside;
	}
	if (stated instanceof FindOperator) {
		return And(stated as FindOperator<string>, outside);
	}
	if (typeof stated === 'string') {
		return And(Equal(stated), outside);
	}
	throw new BadRequestException('A comment read states `entity` as text.');
}
