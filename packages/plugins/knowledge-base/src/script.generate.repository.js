const fs = require('fs');
const path = require('path');

const capitalizeFirstLetter = (input) => {
    return input.charAt(0).toUpperCase() + input.slice(1);
};

// Function to convert camel case to snake case
const convertToCamelCase = (input) => {
    const camelCase = input.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
    return capitalizeFirstLetter(camelCase);
};

const entitiesFolder = './'; // Change this to your entity folder path

const hasEntityFile = (folderPath) => {
    const files = fs.readdirSync(folderPath);
    return files.some(file => file.includes('entity.ts'));
};

const generateRepositoryFile = (entityName) => {
    const camelCaseEntityName = convertToCamelCase(entityName);

    const mikroRepositoryContent = `import { EntityRepository } from '@mikro-orm/core';
import { ${camelCaseEntityName} } from '../${entityName.toLowerCase()}.entity';

export class MikroOrm${camelCaseEntityName}Repository extends EntityRepository<${camelCaseEntityName}> { }`;

    // Create the 'repository' folder if it doesn't exist
    const repositoryFolder = path.dirname(`${entityName}/repository`);
    if (!fs.existsSync(`${entityName}/repository)`)) {
        console.log(`${entityName}/repository`);

        fs.mkdirSync(`${entityName}/repository`, { recursive: true });
    }

    const mikroRepositoryFileName = `${entityName}/repository/mikro-orm-${entityName}.repository.ts`;
    fs.writeFileSync(mikroRepositoryFileName, mikroRepositoryContent);


    const typeRepositoryContent = `import { Repository } from 'typeorm';
import { ${camelCaseEntityName} } from '../${entityName.toLowerCase()}.entity';

export class TypeOrm${camelCaseEntityName}Repository extends Repository<${camelCaseEntityName}> { }`;

    const typeRepositoryFileName = `${entityName}/repository/type-orm-${entityName}.repository.ts`;
    fs.writeFileSync(typeRepositoryFileName, typeRepositoryContent);
};

const scanEntitiesFolder = () => {
    const folders = fs.readdirSync(entitiesFolder, { withFileTypes: true });

    folders.forEach(folder => {
        if (folder.isDirectory()) {
            if (folder.isDirectory() && hasEntityFile(path.join(entitiesFolder, folder.name))) {
                generateRepositoryFile(folder.name);
            }
        }
    });
};

scanEntitiesFolder();
