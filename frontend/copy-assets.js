const fs = require('fs');
const path = require('path');

function copy(src, dest) {
    if (!fs.existsSync(src)) return;
    
    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(file => {
            copy(path.join(src, file), path.join(dest, file));
        });
    } else {
        // don't overwrite files that vite might have processed and placed in the same exact path if any
        if (!fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
        }
    }
}

const dirsToCopy = ['js', 'script', 'data', 'assets'];
dirsToCopy.forEach(dir => {
    copy(path.join(__dirname, dir), path.join(__dirname, 'dist', dir));
});

const filesToCopy = ['manifest.json', 'sw.js'];
filesToCopy.forEach(file => {
    copy(path.join(__dirname, file), path.join(__dirname, 'dist', file));
});

console.log('Static assets copied successfully.');
