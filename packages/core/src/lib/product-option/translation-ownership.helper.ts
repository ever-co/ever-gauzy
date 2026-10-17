import { ForbiddenException } from '@nestjs/common';
import { In, ObjectLiteral, Repository } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext } from './../core/context/request-context';

/** What a product save hands over for one translation: the stored row it names and the row it translates. */
interface ITranslationInput {
	id?: ID;
	referenceId?: ID;
	reference?: { id?: ID } | null;
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

/**
 * Refuses a translation write or removal that reaches another tenant's product data.
 *
 * The product save paths hand option, option group and product translations from the request body straight
 * to the translation repositories, which save or remove the row the stated id names, under the parent the
 * input states, without any tenant check. A stored row is the caller's when it carries the caller's tenant,
 * or when it carries none and the row it translates does: option and option group translations sent by the
 * product form are stored without a tenant. A stated parent must be a row of the caller's tenant. Ids that
 * name no row are left to the write, as before, and nothing is checked without a request tenant (seeds).
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
		translations.map((translation) => translation.reference?.id ?? translation.referenceId)
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
