const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features');
const featureFiles = fs.readdirSync(featuresPath).filter(file => file.endsWith('.json'));

let commands = [];
for (const file of featureFiles) {
    const filePath = path.join(featuresPath, file);
    try {
        const feature = require(filePath);
        if (feature.commands) {
            commands = commands.concat(feature.commands);
        }
    } catch (error) {
        console.log(`Error in ${file}:`, error.message);
    }
}

console.log('Total commands:', commands.length);
commands.forEach((cmd, i) => {
    if (!cmd || !cmd.name) {
        console.log(`Invalid command at index ${i}:`, cmd);
    }
});
