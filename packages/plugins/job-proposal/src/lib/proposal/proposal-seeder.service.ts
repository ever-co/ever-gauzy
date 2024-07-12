import { Injectable } from '@nestjs/common';
import { ConnectionEntityManager, SeedDataService, randomSeedConfig } from '@gauzy/core';
import { createDefaultProposals, createRandomProposals } from './proposal.seed';

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
        private readonly _connectionEntityManager: ConnectionEntityManager,
        private readonly _seeder: SeedDataService
    ) { }

    /**
     * Creates default proposals for organizations.
     *
     * @returns A Promise that resolves when the default proposals are created.
     */
    async createDefaultProposals(): Promise<void> {
        await createDefaultProposals(
            this._connectionEntityManager.rawConnection,
            this._seeder.tenant,
            this._seeder.defaultEmployees,
            this._seeder.organizations,
            randomSeedConfig.proposalsSharingPerOrganizations || 30
        );
    }

    /**
     * Creates random proposals for organizations.
     *
     * @returns A Promise that resolves when the random proposals are created.
     */
    async createRandomProposals(): Promise<void> {
        await createRandomProposals(
            this._connectionEntityManager.rawConnection,
            this._seeder.randomTenants,
            this._seeder.randomTenantOrganizationsMap,
            this._seeder.randomOrganizationEmployeesMap,
            randomSeedConfig.proposalsSharingPerOrganizations || 30
        );
    }
}
