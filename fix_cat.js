const fs = require('fs');
let data = fs.readFileSync('category.html', 'utf8');

const target1 = `        <a href="category.html?cat=tshirt" class="sm-cat-chip">
          <span class="sm-cat-emoji">👕</span> T-Shirts
        </a>
      </div>`;

const target2 = target1.replace(/\n/g, '\r\n');

const replacement = `        <a href="category.html?cat=tshirt" class="sm-cat-chip">
          <span class="sm-cat-emoji">👕</span> T-Shirts
        </a>
        <a href="category.html?cat=shorts" class="sm-cat-chip">
          <span class="sm-cat-emoji">🩳</span> Shorts
        </a>
        <a href="category.html?cat=caps" class="sm-cat-chip">
          <span class="sm-cat-emoji">🧢</span> Caps
        </a>
        <a href="category.html?cat=keychains" class="sm-cat-chip">
          <span class="sm-cat-emoji">🔑</span> Keychains
        </a>
      </div>`;

if (data.includes(target1)) {
  data = data.replace(target1, replacement);
} else if (data.includes(target2)) {
  data = data.replace(target2, replacement);
} else {
  console.log("Target not found!");
}

fs.writeFileSync('category.html', data);
console.log("Done");
