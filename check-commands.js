const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features');
const featureFiles = fs.readdirSync(featuresPath).filter(file => file.endsWith('.json'));

let totalCommands = 0;
console.log('\n📋 Command Count by Feature:\n');

for (const file of featureFiles) {
    const filePath = path.join(featuresPath, file);
    try {
        const feature = require(filePath);
        if (feature.commands) {
            const count = feature.commands.length;
            totalCommands += count;
            console.log(`  ${file.padEnd(30)} ${count} commands`);
        }
    } catch (error) {
        console.log(`  ❌ ${file}: ${error.message}`);
    }
}

console.log('\n' + '='.repeat(50));
console.log(`Total commands: ${totalCommands}\n`);
