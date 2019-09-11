// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { env } from './env';
import { writeFile, unlinkSync } from 'fs';
import { argv } from 'yargs';

const environment = argv.environment;
const isProd = environment === 'prod';

const envFileContent = `// NOTE: Auto-generated file
// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses 'environment.ts', but if you do
// 'ng build --env=prod' then 'environment.prod.ts' will be used instead.
// The list of which env maps to which file can be found in '.angular-cli.json'.

import { Environment } from './model';

export const environment: Environment = {
  production: ${isProd}  
};
`;

/*

// we always want first to remove old generated files (one of them is not needed for current build)
try {
	unlinkSync(`./apps/gauzy/src/environments/environment.ts`);
} catch {}
try {
	unlinkSync(`./apps/gauzy/src/environments/environment.prod.ts`);
} catch {}

const envFileDest: string = isProd ? 'environment.prod.ts' : 'environment.ts';
const envFileDestOther: string = !isProd
	? 'environment.prod.ts'
	: 'environment.ts';

writeFile(`./apps/gauzy/src/environments/${envFileDest}`, envFileContent, function(err) {
	if (err) {
		console.log(err);
	} else {
		console.log(`Generated Angular environment file: ${envFileDest}`);
	}
});

writeFile(`./apps/gauzy/src/environments/${envFileDestOther}`, '', function(err) {
	if (err) {
		console.log(err);
	} else {
		console.log(
			`Generated Second Empty Angular environment file: ${envFileDestOther}`
		);
	}
});

*/