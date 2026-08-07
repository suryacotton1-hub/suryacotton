const fs = require('fs');
const files = fs.readdirSync('./').filter(f => f.endsWith('.html'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  let modified = false;
  
  if (content.includes('href="#hero"')) {
    content = content.replace(/href="#hero"/g, 'href="index.html"');
    modified = true;
  }
  if (content.includes('href="#collection"')) {
    content = content.replace(/href="#collection"/g, 'href="index.html#collection"');
    modified = true;
  }
  if (content.includes('href="#products"')) {
    content = content.replace(/href="#products"/g, 'href="category.html?cat=all"');
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed mobile menu links in ' + file);
  }
}
