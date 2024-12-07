import { ICandidate, ICandidateSource } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from './../core/decorators/entity';
import { MikroOrmCandidateSourceRepository } from './repository/mikro-orm-candidate-source.repository';

@MultiORMEntity('candidate_source', { mikroOrmRepository: () => MikroOrmCandidateSourceRepository })
export class CandidateSource extends TenantOrganizationBaseEntity
    implements ICandidateSource {

    @ApiProperty({ type: () => String })
    @MultiORMColumn()
    name: string;

    /*
    |--------------------------------------------------------------------------
    | @OneToOne
    |--------------------------------------------------------------------------
    */

    @MultiORMOneToOne(() => Candidate, (candidate) => candidate.source, {
        /** This column is a boolean flag indicating that this is the inverse side of the relationship, and it doesn't control the foreign key directly  */
        owner: false
    })
    candidate?: ICandidate;
}
