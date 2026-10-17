import { ForbiddenException } from '@nestjs/common';
import { In, ObjectLiteral, Repository } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext } from './../core/context/request-context';

/** A relation as a request can state it: by an object carrying its id, or by the id itself. */
type RelationInput = { id?: ID } | ID | null;

/** What a product save hands over for one translation: the stored row it names and the row it translates. */
interface ITranslationInput {
	id?: ID;
	tenantId?: ID | null;
	tenant?: RelationInput;
	referenceId?: ID;
	reference?: RelationInput;
}

interface ITenantRow {
	id: ID;
	tenantId?: ID | null;
	reference?: ITenantRow | null;
}

/** The checks only read, through the repositories the translations and their parents are written with. */
type RowReader = Pick<Repository<ObjectLiteral>, 'find'>;

const sameId = (a: unknown, b: unknown): boolean =>
	a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();

const uniqueIds = (ids: unknown[]): ID[] => [...new Set(ids.filter((id) => id != null && id !== ''))] as ID[];

/** TypeORM writes a relation stated as a bare id as that id, so both forms name the same row. */
const relationId = (relation: RelationInput | undefined): unknown =>
	relation != null && typeof relation === 'object' ? relation.id : relation;

/**
 * Refuses a translation write or removal that reaches another tenant's product data.
 *
 * The product save paths hand option, option group and product translations from the request body straight
 * to the translation repositories, which save or remove the row the stated id names, under the parent the
 * input states, without any tenant check. A stored row is the caller's when it carries the caller's tenant,
 * or when it carries none and the row it translates does: option and option group translations sent by the
 * product form are stored without a tenant. On the save paths a stated tenant must be the caller's, since
 * the write keeps it, and a stated parent, by object or by bare id, must be a row of the caller's tenant. Ids
 * that name no row are left to the write, as before, and nothing is checked without a request tenant (seeds).
 *
 * @param translationRepository The TypeORM repository the translations are written through.
 * @param input The translation or translations about to be saved or removed.
 * @param parentRepository The repository of the translated rows, on the save paths only.
 */
export async function assertTranslationsOfTenant(
	translationRepository: RowReader,
	input: ITranslationInput | ITranslationInput[] | undefined | null,
	parentRepository?: RowReader
): Promise<void> {
	const tenantId = RequestContext.currentTenantId();
	const translations = (Array.isArray(input) ? input : [input]).filter(
		(translation): translation is ITranslationInput => !!translation && typeof translation === 'object'
	);
	if (!tenantId || translations.length === 0) {
		return;
	}

	const statedTenantIds = uniqueIds(
		translations.flatMap((translation) => [translation.tenantId, relationId(translation.tenant)])
	);
	if (parentRepository && !statedTenantIds.every((id) => sameId(id, tenantId))) {
		throw new ForbiddenException('The record belongs to another tenant');
	}

	const ids = uniqueIds(translations.map((translation) => translation.id));
	if (ids.length) {
		const rows = (await translationRepository.find({
			where: { id: In(ids) },
			select: { id: true, tenantId: true, reference: { id: true, tenantId: true } },
			relations: { reference: true },
			loadEagerRelations: false,
			withDeleted: true
		})) as ITenantRow[];

		const isOwn = (row: ITenantRow) =>
			sameId(row.tenantId, tenantId) || (row.tenantId == null && sameId(row.reference?.tenantId, tenantId));
		if (!rows.every(isOwn)) {
			throw new ForbiddenException('The record belongs to another tenant');
		}
	}

	if (!parentRepository) {
		return;
	}
	const parentIds = uniqueIds(
		translations.flatMap((translation) => [relationId(translation.reference), translation.referenceId])
	);
	if (parentIds.length) {
		const parents = (await parentRepository.find({
			where: { id: In(parentIds) },
			select: { id: true, tenantId: true },
			loadEagerRelations: false,
			withDeleted: true
		})) as ITenantRow[];

		if (!parents.every((parent) => sameId(parent.tenantId, tenantId))) {
			throw new ForbiddenException('A related record belongs to another tenant');
		}
	}
}
