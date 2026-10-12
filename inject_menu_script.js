const fs = require('fs');
const files = fs.readdirSync('./').filter(f => f.endsWith('.html') && f !== 'checkout.html' && f !== 'admin.html' && f !== 'surya-admin-798.html' && !f.includes('admin') && !f.includes('vault'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('menu.js')) {
    // Append script before closing </body>
    content = content.replace('</body>', '  <script src="menu.js"></script>\n</body>');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Added menu.js to ' + file);
  }
}
