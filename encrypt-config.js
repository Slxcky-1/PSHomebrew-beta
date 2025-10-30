const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const PASSWORD = 'Savannah23';
const SALT = 'pshomebrew-discord-bot-salt-2025';

// Derive key from password
function deriveKey(password) {
    return crypto.scryptSync(password, SALT, 32);
}

// Encrypt config
function encryptConfig(configData, password) {
    const key = deriveKey(password);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(configData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

// Decrypt config
function decryptConfig(encryptedData, password) {
    const key = deriveKey(password);
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'encrypt') {
        // Read config.json
        if (!fs.existsSync('config.json')) {
            console.error('❌ config.json not found!');
            process.exit(1);
        }
        
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        
        // Encrypt
        const encrypted = encryptConfig(config, PASSWORD);
        
        // Save to .secure-config file
        fs.writeFileSync('.secure-config', JSON.stringify(encrypted, null, 2));
        
        console.log('✅ Config encrypted successfully!');
        console.log('📁 Saved to: .secure-config');
        console.log('');
        console.log('⚠️  Important:');
        console.log('   - Add .secure-config to .gitignore if you want to keep it local');
        console.log('   - Or commit it to GitHub (it\'s encrypted and safe)');
        console.log('   - Keep config.json as a local backup');
        
    } else if (command === 'decrypt') {
        // Read encrypted config
        if (!fs.existsSync('.secure-config')) {
            console.error('❌ .secure-config not found!');
            process.exit(1);
        }
        
        const encrypted = JSON.parse(fs.readFileSync('.secure-config', 'utf8'));
        
        // Decrypt
        try {
            const config = decryptConfig(encrypted, PASSWORD);
            
            // Save to config.json
            fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
            
            console.log('✅ Config decrypted successfully!');
            console.log('📁 Saved to: config.json');
            
        } catch (error) {
            console.error('❌ Decryption failed! Wrong password or corrupted file.');
            process.exit(1);
        }
        
    } else {
        console.log('Usage:');
        console.log('  node encrypt-config.js encrypt   - Encrypt config.json to .secure-config');
        console.log('  node encrypt-config.js decrypt   - Decrypt .secure-config to config.json');
    }
}

module.exports = { encryptConfig, decryptConfig, deriveKey };
