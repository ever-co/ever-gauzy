import { ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { assertCallerColumnsAllowed } from '../../core/util/caller-restricted-columns.helper';

/** The pay rate and the client rates a time log stores, which a generic read never answers. */
const HIDDEN_RATES = [
	'payRateValue',
	'payRateCurrency',
	'projectBillRateValue',
	'projectMemberBillRateValue',
	'projectBillRateCurrency',
	'projectMemberBillRateCurrency'
];

const TIME_LOG = {
	name: 'TimeLog',
	tableName: 'time_log',
	findRelationWithPropertyPath: (): undefined => undefined
} as unknown as EntityMetadata;

/**
 * A filter or a sort on a hidden rate answers, by which logs come back or in which order, what the logs never show:
 * like the employee's pay rate and the project's client rates, only a rate editor may name them in a read.
 */
describe("time log rates in a caller's filter, sort or select", () => {
	let granted: PermissionsEnum[];

	beforeEach(() => {
		granted = [];
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(HIDDEN_RATES)('refuses %s to a caller without the right that sets rates', (column) => {
		granted = [PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_VIEW];
		const reads = [{ where: { [column]: 25 } }, { order: { [column]: 'ASC' } }, { select: { [column]: true } }];

		for (const read of reads) {
			jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({ query: read } as any);
			expect(() => assertCallerColumnsAllowed(TIME_LOG, read)).toThrow(ForbiddenException);
		}
	});

	it('lets a rate editor name them', () => {
		granted = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
		const read = { where: { payRateValue: 25 } };
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({ query: read } as any);

		expect(() => assertCallerColumnsAllowed(TIME_LOG, read)).not.toThrow();
	});

	it('CONTROL: the billing rate a log states stays open to every reader, as on the employee', () => {
		granted = [PermissionsEnum.TIME_TRACKER];
		const read = { where: { billRateValue: 40 } };
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({ query: read } as any);

		expect(() => assertCallerColumnsAllowed(TIME_LOG, read)).not.toThrow();
	});
});
