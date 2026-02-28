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

		// Check if extends tsconfig.base.json
		if (json.extends && json.extends.includes('tsconfig.base.json')) {
			// Change to tsconfig.json
			const newExtends = json.extends.replace('tsconfig.base.json', 'tsconfig.json');
			json.extends = newExtends;

			fs.writeFileSync(config.path, JSON.stringify(json, null, '\t') + '\n');
			console.log('Fixed:', config.name, '-', json.extends);
			fixedCount++;
		} else {
			console.log('OK:', config.name, '-', json.extends || 'no extends');
		}
	} catch (e) {
		console.error('Error processing', config.name, ':', e.message);
	}
}

console.log('\nTotal fixed:', fixedCount);
