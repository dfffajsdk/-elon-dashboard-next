const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const newToken = '680aede0-2de4-40ee-b593-401ae3b0e2d1';

try {
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    }

    const lines = content.split('\n');
    let found = false;
    const newLines = lines.map(line => {
        if (line.trim().startsWith('ELONTWEETS_TOKEN=')) {
            found = true;
            return `ELONTWEETS_TOKEN=${newToken}`;
        }
        return line;
    });

    if (!found) {
        newLines.push(`ELONTWEETS_TOKEN=${newToken}`);
    }

    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log('Successfully updated .env.local with new token.');
} catch (e) {
    console.error('Error updating .env.local:', e);
}
