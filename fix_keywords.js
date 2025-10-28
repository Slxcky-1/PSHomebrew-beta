// Quick fix for keyword detection
const fs = require('fs');

let content = fs.readFileSync('bot.js', 'utf8');

// Find and replace the problematic function
const oldFunction = `// Function to check for PS3 error codes (optimized with early exit)
function checkKeywords(message, settings) {
    const messageContent = message.content.toUpperCase();
    
    // Find matching error code
    const foundErrorCode = settings.keywords.list.find(code => {
        const escapedCode = code.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp('\\b' + escapedCode + '\\b', 'i');
        return regex.test(messageContent);
    });
    
    if (!foundErrorCode) return;
    
    // Get error description
    const errorDescription = ps3ErrorCodes[foundErrorCode] || 'Unknown PS3 Error Code';`;

const newFunction = `// Function to check for PS3 error codes (searches ps3ErrorCodes directly)
function checkKeywords(message, settings) {
    const messageContent = message.content;
    
    // Search for any error code from our database in the message
    let foundErrorCode = null;
    
    for (const code of Object.keys(ps3ErrorCodes)) {
        // Create regex to match the error code (case insensitive, word boundary)
        const codePattern = code.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp('\\b' + codePattern + '\\b', 'i');
        if (regex.test(messageContent)) {
            foundErrorCode = code;
            break;
        }
    }
    
    if (!foundErrorCode) return;
    
    // Get error description
    const errorDescription = ps3ErrorCodes[foundErrorCode];`;

content = content.replace(oldFunction, newFunction);

// Also fix the embed fields to remove corrupted emoji characters
content = content.replace(
    /{ name: '.* Error Code', value: foundErrorCode, inline: true },\s*{ name: '.* Status', value: 'Detected', inline: true },\s*{ name: '.* Tip', value:/,
    `{ name: 'Error Code', value: foundErrorCode, inline: true },
            { name: 'Status', value: 'Detected', inline: true },
            { name: 'Tip', value:`
);

// Fix footer
content = content.replace(
    `.setFooter({ text: 'PSHomebrew Community • PS3 Error Code Database' })`,
    `.setFooter({ text: 'PSHomebrew Community - PS3 Error Code Database' })`
);

fs.writeFileSync('bot.js', content, 'utf8');
console.log('✅ Fixed keyword detection function!');
console.log('Now searching ps3ErrorCodes directly instead of settings.keywords.list');

