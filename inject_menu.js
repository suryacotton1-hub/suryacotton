const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');

// Extract the side menu drawer code including the overlay
const sideMenuMatch = indexHtml.match(/(<!-- ============ SIDE MENU DRAWER ============ -->[\s\S]*?<\/aside>)/);
if (!sideMenuMatch) {
  console.log('Side menu not found in index.html');
  process.exit(1);
}
const sideMenuHtml = sideMenuMatch[1];
console.log('Found side menu HTML length:', sideMenuHtml.length);

const files = fs.readdirSync('./').filter(f => f.endsWith('.html') && f !== 'index.html' && f !== 'checkout.html' && f !== 'admin.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('id="sideMenu"')) {
    console.log(file + ' already has side menu.');
    // Replace the old side menu just in case there are updates
    content = content.replace(/<!-- ============ SIDE MENU DRAWER ============ -->[\s\S]*?<\/aside>/, sideMenuHtml);
    fs.writeFileSync(file, content, 'utf8');
    continue;
  }
  
  // Inject after closing </nav> tag
  if (content.includes('</nav>')) {
    content = content.replace('</nav>', '</nav>\n\n  ' + sideMenuHtml);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Injected side menu into ' + file);
  } else {
    console.log('Could not find </nav> in ' + file);
  }
}
