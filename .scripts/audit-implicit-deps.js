const fs = require('fs');
const path = require('path');

function findPackages(dir) {
	const results = [];
	try {
		const items = fs.readdirSync(dir, { withFileTypes: true });

		for (const item of items) {
			if (item.isDirectory()) {
				const pkgPath = path.join(dir, item.name, 'package.json');
				const projPath = path.join(dir, item.name, 'project.json');

				if (fs.existsSync(pkgPath) && fs.existsSync(projPath)) {
					results.push({ name: item.name, pkgPath, projPath, dir: path.join(dir, item.name) });
				}

				// Check subdirectories (for plugins)
				const subDir = path.join(dir, item.name);
				try {
					const subItems = fs.readdirSync(subDir, { withFileTypes: true });
					for (const subItem of subItems) {
						if (subItem.isDirectory()) {
							const subPkgPath = path.join(subDir, subItem.name, 'package.json');
							const subProjPath = path.join(subDir, subItem.name, 'project.json');
							if (fs.existsSync(subPkgPath) && fs.existsSync(subProjPath)) {
								results.push({
									name: subItem.name,
									pkgPath: subPkgPath,
									projPath: subProjPath,
									dir: path.join(subDir, subItem.name)
								});
							}
						}
					}
				} catch (e) {}
			}
		}
	} catch (e) {
		console.error('Error scanning directory:', e.message);
	}
	return results;
}

const packages = findPackages('packages');
console.log('Found', packages.length, 'packages\n');

const gauzyPkgNameToNxName = {
	'@gauzy/constants': 'constants',
	'@gauzy/contracts': 'contracts',
	'@gauzy/common': 'common',
	'@gauzy/utils': 'utils',
	'@gauzy/config': 'config',
	'@gauzy/plugin': 'plugin',
	'@gauzy/auth': 'auth',
	'@gauzy/core': 'core',
	'@gauzy/ui-core': 'ui-core',
	'@gauzy/ui-config': 'ui-config',
	'@gauzy/ui-auth': 'ui-auth',
	'@gauzy/desktop-lib': 'desktop-lib',
	'@gauzy/desktop-ui-lib': 'desktop-ui-lib',
	'@gauzy/desktop-window': 'desktop-window',
	'@gauzy/desktop-core': 'desktop-core',
	'@gauzy/desktop-activity': 'desktop-activity',
	'@gauzy/mcp-server': 'mcp-server',
	'@gauzy/plugin-integration-ai': 'plugin-integration-ai',
	'@gauzy/plugin-integration-github': 'plugin-integration-github',
	'@gauzy/plugin-integration-hubstaff': 'plugin-integration-hubstaff',
	'@gauzy/plugin-integration-upwork': 'plugin-integration-upwork',
	'@gauzy/plugin-job-proposal': 'plugin-job-proposal',
	'@gauzy/plugin-job-search': 'plugin-job-search'
};

const issues = [];

for (const pkg of packages) {
	try {
		const pkgJson = JSON.parse(fs.readFileSync(pkg.pkgPath, 'utf8'));
		const projJson = JSON.parse(fs.readFileSync(pkg.projPath, 'utf8'));

		const deps = { ...pkgJson.dependencies, ...pkgJson.peerDependencies };
		const gauzyDeps = Object.keys(deps).filter((d) => d.startsWith('@gauzy/'));

		const nxNames = gauzyDeps.map((d) => gauzyPkgNameToNxName[d]).filter(Boolean);
		const currentImplicit = projJson.implicitDependencies || [];

		const missing = nxNames.filter((n) => !currentImplicit.includes(n));

		if (missing.length > 0) {
			issues.push({
				name: pkg.name,
				path: pkg.projPath,
				current: currentImplicit,
				shouldHave: nxNames,
				missing: missing
			});
		}
	} catch (e) {
		console.error('Error processing', pkg.name, ':', e.message);
	}
}

if (issues.length === 0) {
	console.log('All packages have correct implicitDependencies!');
} else {
	console.log('Packages with missing implicitDependencies:', issues.length);
	for (const issue of issues) {
		console.log('\n' + issue.name + ':');
		console.log('  Path:', issue.path);
		console.log('  Current:', issue.current.join(', '));
		console.log('  Should have:', issue.shouldHave.join(', '));
		console.log('  Missing:', issue.missing.join(', '));
	}
}
