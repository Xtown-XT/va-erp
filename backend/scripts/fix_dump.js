
const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '../../mysql_59d985b7-13b6-4856-b094-25ce31ad89a0-20251209102320.sql');
const OUTPUT_FILE = path.join(__dirname, '../../restore_ready.sql');

try {
    console.log(`Reading from ${INPUT_FILE}...`);
    let content = fs.readFileSync(INPUT_FILE, 'utf8');

    console.log('Replacing "vehicle" with "machine"...');
    // Global replace case-insensitive
    // We use a regex with 'gi' flag
    const fixedContent = content
        .replace(/vehicle/g, 'machine')
        .replace(/Vehicle/g, 'Machine')
        .replace(/VEHICLE/g, 'MACHINE');

    console.log(`Writing to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, fixedContent, 'utf8');

    console.log('Done! Ready for restore.');
} catch (error) {
    console.error('Error processing file:', error);
}
