import * as fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');

const ipoViewStart = content.indexOf('function IPOView(');
if (ipoViewStart === -1) {
    console.error("IPOView not found");
    process.exit(1);
}

const ipoViewReturn = content.slice(ipoViewStart);
const returnIndex = ipoViewReturn.indexOf('return (');
const codeToParse = ipoViewReturn.slice(returnIndex);

let openTags: { name: string; line: number }[] = [];
let lines = codeToParse.split('\n');

for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i];
    
    // Quick scan of tags in this line
    const tagRegex = /<(\/?[a-zA-Z0-9\._-]+)(\s+[^>]*?)?\/?>/g;
    let match;
    while ((match = tagRegex.exec(lineText)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        
        if (fullTag.endsWith('/>')) {
            continue; // Self-closing
        }
        
        // Ignore native inline elements that might be used without closed
        if (['style', 'img', 'br', 'input'].includes(tagName)) {
            continue;
        }

        if (tagName.startsWith('/')) {
            const closedName = tagName.slice(1);
            if (openTags.length === 0) {
                console.log(`[Line ${lineNum}] Error: closing </${closedName}> but no tag is open!`);
            } else {
                const last = openTags.pop();
                if (last?.name !== closedName) {
                    console.log(`[Line ${lineNum}] Error: closing </${closedName}> but last open tag was <${last?.name}> from line ${last?.line}`);
                    // Push back to try to recover
                    if (last) openTags.push(last);
                }
            }
        } else {
            openTags.push({ name: tagName, line: lineNum });
        }
    }
}

console.log("Remaining open tags at end of file:", openTags);
