const fs = require('fs');
let html = fs.readFileSync('category.html', 'utf8');

const regex = /function buildTickerHTML\(items\) \{\s*return items\.map\(\(item, i\) => \`[\s\S]*?<\/span>\s*\/\* ---- RENDER GRID ---- \*\//m;

const replacement = `function buildTickerHTML(items) {
      return items.map((item, i) => \`
        <a class="ticker-tag" href="category.html?cat=\${catKey}" onclick="event.preventDefault();filterSubcat('\${item.label}')">
          <img class="ticker-tag-img" src="\${item.img}" alt="\${item.label}" loading="lazy" />
          <span class="ticker-tag-label">\${item.label}</span>
        </a>
        \${i < items.length - 1 ? '<span class="ticker-divider">✦</span>' : ''}
      \`).join('');
    }

    const tickerHTML = buildTickerHTML(tickerItems);
    if(tickerItems.length > 0) {
      tickerTrack.innerHTML = tickerHTML + '<span class="ticker-divider">✦</span>' + tickerHTML;
    }

    const tickerStrip = document.getElementById('catTickerStrip');
    let isScrolling = true;
    tickerStrip.addEventListener('touchstart', () => isScrolling = false, {passive:true});
    tickerStrip.addEventListener('touchend', () => isScrolling = true, {passive:true});
    tickerStrip.addEventListener('mouseenter', () => isScrolling = false);
    tickerStrip.addEventListener('mouseleave', () => isScrolling = true);
    
    let scrollPos = 0;
    function autoScrollTicker() {
      if (isScrolling && tickerStrip.scrollWidth > tickerStrip.clientWidth) {
        scrollPos += 0.8;
        tickerStrip.scrollLeft = scrollPos;
        if (tickerStrip.scrollLeft >= tickerStrip.scrollWidth / 2) {
          scrollPos = 0;
          tickerStrip.scrollLeft = 0;
        }
      } else {
        scrollPos = tickerStrip.scrollLeft;
      }
      requestAnimationFrame(autoScrollTicker);
    }
    if (tickerItems.length > 0) {
      requestAnimationFrame(autoScrollTicker);
    }

    function filterSubcat(s) {
      activeSub = s;
      renderGrid();
    }

    /* ---- RENDER GRID ---- */`;

html = html.replace(regex, replacement);
fs.writeFileSync('category.html', html);
console.log('Fixed JS');
