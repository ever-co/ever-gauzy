import { Injectable } from '@nestjs/common';
import { ConnectionEntityManager, SeedDataService } from '@gauzy/core';

/**
 * Service dealing with help center based operations.
 *
 * @class
 */
@Injectable()
export class ProposalSeederService {
    /**
     * Create an instance of class.
     *
     * @constructs
     *
     */
    constructor(
        private readonly connectionEntityManager: ConnectionEntityManager,
        private readonly seeder: SeedDataService
    ) { }
}
