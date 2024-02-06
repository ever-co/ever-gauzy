import { Column } from 'typeorm';
import { ICandidate, ICandidateSource } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateSourceRepository } from './repository/mikro-orm-candidate-source.repository';
import { MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_source', { mikroOrmRepository: () => MikroOrmCandidateSourceRepository })
export class CandidateSource extends TenantOrganizationBaseEntity
    implements ICandidateSource {

    @ApiProperty({ type: () => String })
    @Column()
    name: string;

    /*
    |--------------------------------------------------------------------------
    | @OneToOne
    |--------------------------------------------------------------------------
    */

    @MultiORMOneToOne(() => Candidate, (candidate) => candidate.source, { owner: true })
    candidate?: ICandidate;
}
