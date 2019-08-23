// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Injectable } from '@nestjs/common';
import { Connection, createConnection, getRepository, ConnectionOptions, getConnection } from 'typeorm';
import chalk from 'chalk';
import { environment as env } from '@env-api/environment'
import { Role, createRoles } from '../../role';
import { User, createUsers } from '../../user';
import { Employee, createEmployees } from '../../employee';
import { Organization, createOrganizations } from '../../organization';
import { Income } from '../../income';
import { Expense } from '../../expense';
import { EmployeeSettings } from '../../employee-settings/employee-settings.entity';
import { createUsersOrganizations } from '../../user-organization';

const allEntities = [User, Employee, Role, Organization, Income, Expense, EmployeeSettings];

@Injectable()
export class SeedDataService {
  connection: Connection;
  log = console.log;

  constructor() { }

  async createConnection() {
    try {
      this.log(chalk.green('🏃‍CONNECTING TO DATABASE...'));

      this.connection = await getConnection();

      if (!this.connection.isConnected) {
        this.connection = await createConnection(
          {
            ...env.database,
            entities: allEntities,
          } as ConnectionOptions
        );
      }
    }
    catch (error) {
      this.handleError(error, 'Unable to connect to database');
    }
  }

  /**
   * Seed data
   */
  async run() {

    try {
      // Connect to database
      await this.createConnection();

      // Reset database to start with new, fresh data
      await this.resetDatabase();

      // Seed data with mock / fake data
      await this.seedData();

      console.log('Database Seed completed');
    }
    catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Populate database with mock data
   */
  async seedData() {
    try {
      this.log(chalk.green(`🌱 SEEDING ${env.production ? 'PRODUCTION' : ''} DATABASE...`));

      const roles: Role[] = await createRoles(this.connection);
      const { adminUsers, defaultUsers, randomUsers } = await createUsers(this.connection, roles);
      const { defaultOrganization, randomOrganizations } = await createOrganizations(this.connection);

      const employees = await createEmployees(
        this.connection,
        { org: defaultOrganization, users: [...defaultUsers] },
        { orgs: randomOrganizations, users: [...randomUsers] },
      );

      const usersOrganizations = await createUsersOrganizations(
        this.connection,
        { org: defaultOrganization, users: [...defaultUsers, ...adminUsers] },
        { orgs: randomOrganizations, users: [...randomUsers] },
      );

      this.log(chalk.green(`✅ SEEDED ${env.production ? 'PRODUCTION' : ''} DATABASE`));
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Retrieve entities metadata
   */
  async getEntities() {
    const entities = [];
    try {
      (await (await this.connection).entityMetadatas).forEach(
        entity => entities.push({ name: entity.name, tableName: entity.tableName })
      );
      return entities;
    } catch (error) {
      this.handleError(error, 'Unable to retrieve database metadata');
    }
  };

  /**
   * Cleans all the entities
   * Removes all data from database
   */
  async cleanAll(entities) {
    try {
      for (const entity of entities) {
        const repository = await getRepository(entity.name);
        await repository.query(`TRUNCATE TABLE "public"."${entity.tableName}" CASCADE;`);
      }
    } catch (error) {
      this.handleError(error, 'Unable to clean database');
    }
  };

  /**
   * Reset the database, truncate all tables (remove all data)
   */
  async resetDatabase() {
    const entities = await this.getEntities();
    await this.cleanAll(entities);
    //await loadAll(entities);
  };

  private handleError(error: Error, message?: string): void {
    this.log(chalk.bgRed(`🛑 ERROR: ${!!message ? message : 'Unable to seed database'}`));
    throw new Error(`🛑  ${error}`);
  }
}
