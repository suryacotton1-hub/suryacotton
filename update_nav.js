const fs = require('fs');
const path = require('path');

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const replacement = `<ul class="nav-links" id="navLinks">
      <li><a href="index.html" class="nav-link">Home</a></li>
      <li><a href="index.html#collection" class="nav-link">Collection</a></li>
      <li><a href="category.html?cat=all" class="nav-link">Shop</a></li>
      <li><a href="track.html" class="nav-link">Track Order</a></li>
      <li><a href="story.html" class="nav-link">About Us</a></li>
      <li><a href="contact.html" class="nav-link">Contact</a></li>
    </ul>`;

const regex = /<ul class="nav-links" id="navLinks">[\s\S]*?<\/ul>/g;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
