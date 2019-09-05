// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import { IEnvironment } from './ienvironment';
import { CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/models';

export const environment: IEnvironment = {
  production: false,
  envName: 'dev',

  env: {
    LOG_LEVEL: 'debug'
  },

  USER_PASSWORD_BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: 'secretKey',

  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: 'root',
    keepConnectionAlive: true,
    logging: true,
    synchronize: true,
    uuidExtension: 'pgcrypto'
  },

  defaultOrganization: {
    name: 'Ever Technologies LTD',
    currency: CurrenciesEnum.BGN,
    defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
    imageUrl: 'assets/images/logos/ever-large.jpg'
  },

  defaultAdmins: [
    {
      email: 'admin@ever.co',
      password: 'admin',
      imageUrl: 'assets/images/avatars/ruslan.jpg'
    }
  ],

  defaultEmployees: [
    {
      email: 'alish@ever.co',
      password: '123456',
      firstName: 'Alish',
      lastName: 'Meklyov',
      imageUrl: 'assets/images/avatars/alish.jpg'
    },
    {
      email: 'blagovest@ever.co',
      password: '123456',
      firstName: 'Blagovest',
      lastName: 'Gerov',
      imageUrl: 'assets/images/avatars/blagovest.jpg'
    },
    {
      email: 'elvis@ever.co',
      password: '123456',
      firstName: 'Elvis',
      lastName: 'Arabadjiiski',
      imageUrl: 'assets/images/avatars/elvis.jpg'
    },
    {
      email: 'emil@ever.co',
      password: '123456',
      firstName: 'Emil',
      lastName: 'Momchilov',
      imageUrl: 'assets/images/avatars/emil.jpg'
    },
    {
      email: 'boyan@ever.co',
      password: '123456',
      firstName: 'Boyan',
      lastName: 'Stanchev',
      imageUrl: 'assets/images/avatars/boyan.jpg'
    },
    {
      email: 'hristo@ever.co',
      password: '123456',
      firstName: 'Hristo',
      lastName: 'Hristov',
      imageUrl: 'assets/images/avatars/hristo.jpg'
    },
    {
      email: 'milena@ever.co',
      password: '123456',
      firstName: 'Milena',
      lastName: 'Dimova',
      imageUrl: 'assets/images/avatars/milena.jpg'
    }
  ]
};
