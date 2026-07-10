#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'src/assets/images');
const BATCH_SIZE = 10;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('batch_')) {
        continue;
      }
      walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(fullPath);
    }
  }
  return files;
}

function replaceInTree(dir, replacements) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'ios/build', 'android/build'].includes(entry.name)) {
        continue;
      }
      replaceInTree(fullPath, replacements);
      continue;
    }

    if (!/\.(js|jsx|ts|tsx|json)$/.test(entry.name)) {
      continue;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    for (const [from, to] of replacements) {
      if (content.includes(from)) {
        content = content.split(from).join(to);
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Updated ${path.relative(ROOT, fullPath)}`);
    }
  }
}

const flatImages = fs
  .readdirSync(IMAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

if (flatImages.length === 0) {
  console.log('No flat PNG files to organize.');
  process.exit(0);
}

const replacements = [];

flatImages.forEach((fileName, index) => {
  const batchNumber = String(Math.floor(index / BATCH_SIZE) + 1).padStart(2, '0');
  const batchDir = path.join(IMAGES_DIR, `batch_${batchNumber}`);
  fs.mkdirSync(batchDir, { recursive: true });

  const fromPath = path.join(IMAGES_DIR, fileName);
  const toPath = path.join(batchDir, fileName);
  fs.renameSync(fromPath, toPath);

  const fromRef = `assets/images/${fileName}`;
  const toRef = `assets/images/batch_${batchNumber}/${fileName}`;
  replacements.push([fromRef, toRef]);
  console.log(`Moved ${fileName} -> batch_${batchNumber}/`);
});

replaceInTree(ROOT, replacements);
console.log(`Organized ${flatImages.length} images into ${Math.ceil(flatImages.length / BATCH_SIZE)} folders.`);
