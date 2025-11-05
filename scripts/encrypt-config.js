const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

// Derive encryption key from a passphrase
function deriveKey(passphrase) {
    return crypto.createHash('sha256').update(passphrase).digest();
}

// Encrypt data
function encrypt(text, passphrase) {
    const key = deriveKey(passphrase);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
}

// Decrypt data
function decrypt(encryptedData, passphrase) {
    const key = deriveKey(passphrase);
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
    console.log('Usage:');
    console.log('  node encrypt-config.js encrypt   - Encrypt config.json to .secure-config');
    console.log('  node encrypt-config.js decrypt   - Decrypt .secure-config to config.json');
    process.exit(0);
}

if (command === 'encrypt') {
    try {
        // Read config.json
        const configPath = path.join(__dirname, 'config.json');
        const config = fs.readFileSync(configPath, 'utf8');
        
        // Get passphrase (use environment variable or prompt)
        const passphrase = process.env.CONFIG_PASSPHRASE || 'default-passphrase-change-me';
        
        // Encrypt
        const encrypted = encrypt(config, passphrase);
        
        // Save encrypted config
        const securePath = path.join(__dirname, '.secure-config');
        fs.writeFileSync(securePath, encrypted, 'utf8');
        
        console.log('✅ Configuration encrypted successfully!');
        console.log('📁 Encrypted file saved to: .secure-config');
        console.log('⚠️  Remember your passphrase!');
        
    } catch (error) {
        console.error('❌ Encryption error:', error.message);
        process.exit(1);
    }
    
} else if (command === 'decrypt') {
    try {
        // Read encrypted config
        const securePath = path.join(__dirname, '.secure-config');
        const encrypted = fs.readFileSync(securePath, 'utf8');
        
        // Get passphrase
        const passphrase = process.env.CONFIG_PASSPHRASE || 'default-passphrase-change-me';
        
        // Decrypt
        const decrypted = decrypt(encrypted, passphrase);
        
        // Save decrypted config
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, decrypted, 'utf8');
        
        console.log('✅ Configuration decrypted successfully!');
        console.log('📁 Decrypted file saved to: config.json');
        
    } catch (error) {
        console.error('❌ Decryption error:', error.message);
        process.exit(1);
    }
    
} else {
    console.error('❌ Invalid command. Use "encrypt" or "decrypt"');
    process.exit(1);
}
