const fs = require('fs');
let html = fs.readFileSync('category.html', 'utf8');

const regex = /\.cat-ticker-strip\s*\{[\s\S]*?\.ticker-tag-img\s*\{/m;

const replacement = `.cat-ticker-strip {
      background: #fff;
      border-top: 1px solid rgba(0,0,0,0.06);
      border-bottom: 1px solid rgba(0,0,0,0.06);
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding: 0;
      position: relative;
      box-shadow: 0 2px 12px rgba(0,0,0,0.03);
    }
    .cat-ticker-strip::-webkit-scrollbar { display: none; }
    .cat-ticker-strip::before, .cat-ticker-strip::after {
      content: '';
      position: absolute; top: 0; bottom: 0; width: 80px; z-index: 2; pointer-events: none;
    }
    .cat-ticker-strip::before { left: 0; background: linear-gradient(to right, #fff, transparent); }
    .cat-ticker-strip::after { right: 0; background: linear-gradient(to left, #fff, transparent); }
    .cat-ticker-track { display: flex; align-items: center; width: max-content; padding: 14px 0; }
    .ticker-tag {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 8px 20px 8px 8px; margin: 0 10px;
      border: 1px solid rgba(0,0,0,0.08); border-radius: 50px;
      background: #f8f7f5; cursor: pointer;
      transition: background 0.25s, border-color 0.25s, transform 0.25s, box-shadow 0.25s;
      white-space: nowrap; text-decoration: none;
    }
    .ticker-tag:hover {
      background: rgba(232,0,13,0.06);
      border-color: var(--red);
      transform: scale(1.04);
      box-shadow: 0 4px 16px rgba(232,0,13,0.1);
    }
    .ticker-tag-img {`;

html = html.replace(regex, replacement);
fs.writeFileSync('category.html', html);
console.log('Fixed CSS');
