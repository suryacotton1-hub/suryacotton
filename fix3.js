const fs = require('fs');

const scriptBlock = `
// Sync profile pic from localStorage on page load (Moved from index.html)
(function() {
  try {
    const isLoggedIn = localStorage.getItem('sc_isLoggedIn') === 'true';
    if (!isLoggedIn) return;
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sc_profile_'));
    if (!keys.length) return;
    const profile = JSON.parse(localStorage.getItem(keys[0]) || '{}');
    const avatar = profile.avatar;
    if (avatar) {
      const navPic = document.getElementById('navProfilePic');
      const navIcon = document.getElementById('navProfileIcon');
      if (navPic) { navPic.src = avatar; navPic.classList.remove('hidden'); }
      if (navIcon) navIcon.style.display = 'none';
      
      const smImg = document.getElementById('smAvatarImg');
      const smIcon = document.getElementById('smAvatarIcon');
      if (smImg) { smImg.src = avatar; smImg.classList.remove('hidden'); }
      if (smIcon) smIcon.style.display = 'none';
    }
    const name = profile.name;
    if (name) {
      const smName = document.getElementById('smUserName');
      const smSub = document.getElementById('smUserSub');
      if (smName) smName.textContent = name;
      if (smSub) smSub.textContent = 'View your profile & orders';
    }
  } catch(e) {}
})();
`;

let scriptJs = fs.readFileSync('script.js', 'utf8');
if (!scriptJs.includes('sc_isLoggedIn')) {
  fs.writeFileSync('script.js', scriptJs + '\n' + scriptBlock, 'utf8');
  console.log('Appended to script.js');
} else {
  console.log('Already in script.js');
}
