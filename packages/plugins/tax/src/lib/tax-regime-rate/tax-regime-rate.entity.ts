import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { TaxRate } from '../tax-rate/tax-rate.entity';
import { TaxRegime } from '../tax-regime/tax-regime.entity';
import { MikroOrmTaxRegimeRateRepository } from './repository/mikro-orm-tax-regime-rate.repository';

/**
 * The membership of one rate in one regime.
 *
 * A pivot, and the whole of the regime mechanism: the presence of a row is what makes a rate
 * regime-specific, and its absence is what keeps the rate general. A rate with at least one row is a
 * candidate only when one of its regimes is the one selected for the document, so attaching a rate to a
 * regime removes it from every other regime's documents — which is the intent and must be stated, because
 * it is the half of the rule that surprises.
 *
 * The row has no independent lifecycle: membership is set through the regime it belongs to, under the
 * regime's editing permission, and a rate is never detached from a client that cannot see the regime.
 */
/** A rate belongs to a regime once. */
@ColumnIndex('UQ_tax_regime_rate', ['taxRegimeId', 'taxRateId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
/** The membership of a rate, which is what the resolution reads to decide whether it is general. */
@ColumnIndex('IDX_tax_regime_rate_rate', ['taxRateId'])
@MultiORMEntity('tax_regime_rate', { mikroOrmRepository: () => MikroOrmTaxRegimeRateRepository })
export class TaxRegimeRate extends TenantOrganizationBaseEntity {
	/**
	 * The regime the rate belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMManyToOne(() => TaxRegime, (regime) => regime.rates, {
		/** The membership has no meaning without either peer. */
		onDelete: 'CASCADE'
	})
	taxRegime?: TaxRegime;

	/**
	 * The regime's id, as the queryable column.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	taxRegimeId: ID;

	/**
	 * The rate that is a member of the regime.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMManyToOne(() => TaxRate, (rate) => rate.regimeMemberships, {
		/** The membership has no meaning without either peer. */
		onDelete: 'CASCADE'
	})
	taxRate?: TaxRate;

	/**
	 * The rate's id, as the queryable column.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	taxRateId: ID;
}
