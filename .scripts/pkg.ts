import { argv } from 'yargs';
import { writeFile } from 'fs';

const platform = argv.platform || 'mac';

const fileName = 'package.json';

let platformConfig = `[
        "node14-mac-x64"
    ]`;

let platformAssets = `"../../../../../node_modules/node-mac/**/*"`;

let platformDeps = `"node-mac": "^1.0.1"`

if (platform === 'win') {
    platformConfig = `[
        "node14-win-x64"
    ]`;

    platformAssets = `
       " ../../../../../node_modules/node-windows/**/*"
    `;

    platformDeps = `"node-windows": "^1.0.0-beta.5"`
}

const pkgConfig = `
    {
        "name": "@gauzy/api-server",
        "version": "0.1.0",
        "description": "Gauzy API",
        "license": "AGPL-3.0",
        "homepage": "https://gauzy.co",
        "repository": {
            "type": "git",
            "url": "git+https://github.com/ever-co/gauzy.git"
        },
        "bugs": {
            "url": "https://github.com/ever-co/gauzy/issues"
        },
        "private": true,
        "author": {
            "name": "Ever Co. LTD",
            "email": "ever@ever.co",
            "url": "https://ever.co"
        },
        "scripts": {
            "build": "yarn ng build api"
        },
        "dependencies": {
            "@gauzy/changelog": "^0.1.0",
            "@gauzy/core": "^0.1.0",
            "@gauzy/knowledge-base": "^0.1.0",
            "node-static": "^0.7.11",
            ${platformDeps}
        },
        "bin": "gauzy-service.js",
        "pkg": {
            "scripts": "./*.js",
            "assets": [
                "../../../../../node_modules/bcrypt/lib/**/*",
                "../../../../../node_modules/linebreak/src/classes.trie",
                "../../../../../ormlogs.log",
                "./data/**/*",
                "./api/**/*",
                "./service.js",
                ${platformAssets}
            ],
            "targets": ${platformConfig}
        }
    }
`

writeFile(
	`./dist/apps/gauzy-server/server/${fileName}`,
	pkgConfig,
	function (err) {
		if (err) {
			console.log(err);
		} else {
			console.log(`Generated pkg config file: ${fileName}`);
		}
	}
);