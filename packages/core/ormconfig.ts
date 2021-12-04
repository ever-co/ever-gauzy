import { ConnectionOptions } from "typeorm";
import { join } from 'path';


// Check typeORM documentation for more information.
const ormconfig : ConnectionOptions = {
    type: "sqlite",
    // host: "localhost",
    // port: 5432,
    // username: "postgres",
    // password: "root",
    database: "D:\\ever\\ever-gauzy\\packages\\core\\apps\\api\\data\\gauzy.sqlite3",
    entities: [
    ],
    synchronize: false,

    // Run migrations automatically,
    // you can disable this if you prefer running migration manually.
    logging: false,
    logger: 'file',

    // Allow both start:prod and start:dev to use migrations
    // __dirname is either dist or src folder, meaning either
    // the compiled js in prod or the ts in dev.
    migrations: [
        join(__dirname, 'src/database/migrations/**/*{.ts,.js}')
    ],
    cli: {
        // Location of migration should be inside src folder
        // to be compiled into dist/ folder.
        migrationsDir: 'src/database/migrations'
    }
};

export = ormconfig;