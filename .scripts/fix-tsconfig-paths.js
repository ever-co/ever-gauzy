const fs = require('fs');
const path = require('path');

// Find all tsconfig.json files in packages/plugins
function findPluginTsconfigs(dir) {
	const results = [];
	try {
		const items = fs.readdirSync(dir, { withFileTypes: true });
		for (const item of items) {
			if (item.isDirectory()) {
				const tsconfigPath = path.join(dir, item.name, 'tsconfig.json');
				if (fs.existsSync(tsconfigPath)) {
					results.push({ name: item.name, path: tsconfigPath });
				}
			}
		}
	} catch (e) {
		console.error('Error:', e.message);
	}
	return results;
}

const pluginTsconfigs = findPluginTsconfigs('packages/plugins');
console.log('Found', pluginTsconfigs.length, 'plugin tsconfig.json files\n');

let fixedCount = 0;

for (const config of pluginTsconfigs) {
	try {
		const content = fs.readFileSync(config.path, 'utf8');
		const json = JSON.parse(content);

		let modified = false;

		// Remove paths if it only contains @gauzy paths that point to dist
		if (json.compilerOptions && json.compilerOptions.paths) {
			const paths = json.compilerOptions.paths;
			const gauzyPaths = Object.keys(paths).filter((k) => k.startsWith('@gauzy/'));

			if (gauzyPaths.length > 0) {
				// Check if all gauzy paths point to dist
				const allDistPaths = gauzyPaths.every((k) => {
					const pathValues = paths[k];
					return pathValues.some((p) => p.includes('/dist/'));
				});

				if (allDistPaths) {
					// Remove these paths - let them inherit from parent
					for (const k of gauzyPaths) {
						delete paths[k];
					}

					// If no paths left, remove the paths object
					if (Object.keys(paths).length === 0) {
						delete json.compilerOptions.paths;
					}

					modified = true;
					console.log('Removed @gauzy paths from:', config.name);
				}
			}
		}

		// Remove baseUrl: "." if present (let it inherit)
		if (json.compilerOptions && json.compilerOptions.baseUrl === '.') {
			delete json.compilerOptions.baseUrl;
			modified = true;
			console.log('Removed baseUrl from:', config.name);
		}

		if (modified) {
			fs.writeFileSync(config.path, JSON.stringify(json, null, '\t') + '\n');
			fixedCount++;
		}
	} catch (e) {
		console.error('Error processing', config.name, ':', e.message);
	}
}

console.log('\nTotal fixed:', fixedCount);
