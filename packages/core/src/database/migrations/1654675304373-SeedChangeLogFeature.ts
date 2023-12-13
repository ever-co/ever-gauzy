import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { v4 as uuidV4 } from 'uuid';

export class SeedChangeLogFeature1654675304373 implements MigrationInterface {

    name = 'SeedChangeLogFeature1654675304373';

    public async up(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        const date = ['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type) ? Date.now() : new Date();
        const features = [
            {
                icon: 'cube-outline',
                title: 'New CRM',
                date,
                isFeature: true,
                content: 'Now you can read latest features changelog directly in Gauzy',
                learnMoreUrl: '',
                imageUrl: 'assets/images/features/macbook-2.png'
            },
            {
                icon: 'globe-outline',
                title: 'Most popular in 20 countries',
                date,
                isFeature: true,
                content: 'Europe, Americas and Asia get choise',
                learnMoreUrl: '',
                imageUrl: 'assets/images/features/macbook-1.png'
            },
            {
                icon: 'flash-outline',
                title: 'Visit our website',
                date,
                isFeature: true,
                content: 'You are welcome to check more information about the platform at our official website.',
                learnMoreUrl: '',
                imageUrl: ''
            }
        ];
        try {
            for await (const feature of features) {
                const payload = Object.values(feature);
                if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
                    payload.push(uuidV4());
                    await queryRunner.connection.manager.query(`
                        INSERT INTO "changelog" ("icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl", "id") VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
                        payload
                    );
                } else {
                    await queryRunner.connection.manager.query(`
                        INSERT INTO "changelog" ("icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl") VALUES($1, $2, $3, $4, $5, $6, $7)`,
                        payload
                    );
                }
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while insert changelog changes in production server', error);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {

    }
}
