const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

console.log('🔒 Starting code obfuscation...\n');

// Files to obfuscate
const filesToObfuscate = [
    'bot.js',
    'deploy-commands.js',
    'encrypt-config.js'
];

// Obfuscation options - balanced for protection vs performance
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    debugProtection: false, // Set to true for extra protection (but harder to debug)
    debugProtectionInterval: 0,
    disableConsoleOutput: false, // Keep console logs working
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 5,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// Create obfuscated directory if it doesn't exist
const obfuscatedDir = path.join(__dirname, 'obfuscated');
if (!fs.existsSync(obfuscatedDir)) {
    fs.mkdirSync(obfuscatedDir);
}

// Obfuscate each file
filesToObfuscate.forEach(file => {
    try {
        console.log(`📝 Obfuscating ${file}...`);
        
        const filePath = path.join(__dirname, file);
        const code = fs.readFileSync(filePath, 'utf8');
        
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscationOptions).getObfuscatedCode();
        
        const outputPath = path.join(obfuscatedDir, file);
        fs.writeFileSync(outputPath, obfuscatedCode);
        
        console.log(`✅ ${file} obfuscated successfully`);
        console.log(`   Original size: ${(code.length / 1024).toFixed(2)} KB`);
        console.log(`   Obfuscated size: ${(obfuscatedCode.length / 1024).toFixed(2)} KB\n`);
        
    } catch (error) {
        console.error(`❌ Error obfuscating ${file}:`, error.message);
    }
});

// Copy command files
console.log('\n📂 Copying command files...');
const commandsDir = path.join(__dirname, 'commands');
const obfuscatedCommandsDir = path.join(obfuscatedDir, 'commands');

if (!fs.existsSync(obfuscatedCommandsDir)) {
    fs.mkdirSync(obfuscatedCommandsDir);
}

if (fs.existsSync(commandsDir)) {
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
    
    commandFiles.forEach(file => {
        try {
            console.log(`📝 Obfuscating commands/${file}...`);
            
            const code = fs.readFileSync(path.join(commandsDir, file), 'utf8');
            const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscationOptions).getObfuscatedCode();
            
            fs.writeFileSync(path.join(obfuscatedCommandsDir, file), obfuscatedCode);
            console.log(`✅ commands/${file} obfuscated`);
            
        } catch (error) {
            console.error(`❌ Error obfuscating commands/${file}:`, error.message);
        }
    });
}

// Copy feature files (JSON - no obfuscation needed)
console.log('\n📂 Copying feature files...');
const featuresDir = path.join(__dirname, 'features');
const obfuscatedFeaturesDir = path.join(obfuscatedDir, 'features');

if (!fs.existsSync(obfuscatedFeaturesDir)) {
    fs.mkdirSync(obfuscatedFeaturesDir);
}

if (fs.existsSync(featuresDir)) {
    const featureFiles = fs.readdirSync(featuresDir);
    featureFiles.forEach(file => {
        fs.copyFileSync(
            path.join(featuresDir, file),
            path.join(obfuscatedFeaturesDir, file)
        );
    });
    console.log(`✅ Copied ${featureFiles.length} feature files`);
}

// Copy other necessary files
console.log('\n📂 Copying configuration files...');
const filesToCopy = [
    'package.json',
    'package-lock.json',
    '.secure-config',
    'config.example.json',
    'LICENSE',
    'NOTICE.md',
    'README.md'
];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(obfuscatedDir, file));
        console.log(`✅ Copied ${file}`);
    }
});

// Copy docs directory
const docsDir = path.join(__dirname, 'docs');
const obfuscatedDocsDir = path.join(obfuscatedDir, 'docs');
if (fs.existsSync(docsDir)) {
    if (!fs.existsSync(obfuscatedDocsDir)) {
        fs.mkdirSync(obfuscatedDocsDir);
    }
    const docFiles = fs.readdirSync(docsDir);
    docFiles.forEach(file => {
        fs.copyFileSync(
            path.join(docsDir, file),
            path.join(obfuscatedDocsDir, file)
        );
    });
    console.log(`✅ Copied docs directory (${docFiles.length} files)`);
}

// Copy linux-installation directory
const linuxDir = path.join(__dirname, 'linux-installation');
const obfuscatedLinuxDir = path.join(obfuscatedDir, 'linux-installation');
if (fs.existsSync(linuxDir)) {
    if (!fs.existsSync(obfuscatedLinuxDir)) {
        fs.mkdirSync(obfuscatedLinuxDir);
    }
    const linuxFiles = fs.readdirSync(linuxDir);
    linuxFiles.forEach(file => {
        fs.copyFileSync(
            path.join(linuxDir, file),
            path.join(obfuscatedLinuxDir, file)
        );
    });
    console.log(`✅ Copied linux-installation directory (${linuxFiles.length} files)`);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Obfuscation complete!');
console.log('='.repeat(60));
console.log('\n📁 Obfuscated files are in: ./obfuscated/');
console.log('\n⚠️  IMPORTANT:');
console.log('   - Keep your ORIGINAL files (current directory)');
console.log('   - Push OBFUSCATED files to GitHub');
console.log('   - Original code is for your development');
console.log('   - Obfuscated code is for public viewing\n');
