const CONFIG = {
  SUPABASE_URL: 'https://rcgrcqlqwcmnjweqzptn.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZ3JjcWxxd2Ntbmp3ZXF6cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5Njk0NjAsImV4cCI6MjA3NDU0NTQ2MH0.fzSW136Y0W0tcqriqyB5oYaczbuAgFYngg3_XCIM8s4',
  DISCORD_WEBHOOK_ID: '1422207672949936188',
  DISCORD_WEBHOOK_TOKEN: 'yIspSgVjxKfCHU7S2W1f6K9sHIbawxvv3s_qGfejm3ddGSEH_NFVGgynhlI_d5dBFrS7',
  QR_REWARD: 50,
  SPIN_REWARD: [20, 50, 100, 200, 500]
};

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
let currentUser = null, soundOn = true, streak = 0, spinToday = false;

const el = id => document.getElementById(id);
const play = id => soundOn && el(id).play();
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function hash(p) { return bcrypt.hashSync(p, 10); }
async function verify(p, h) { return bcrypt.compareSync(p, h); }

async function login(e) {
  e.preventDefault();
  const username = el('login-username').value.trim();
  const plain = el('login-password').value;
  const { data: user } = await supabaseClient.from('users').select('*').eq('username', username).single();
  if (!user) return notify('Username tidak ditemukan', 'error');
  const ok = await verify(plain, user.password);
  if (!ok) return notify('Password salah', 'error');
  currentUser = user;
  localStorage.setItem('fsm4e_user', JSON.stringify(user));
  hideModals();
  showDashboard();
  notify('Login berhasil', 'success');
}

async function register(e) {
  e.preventDefault();
  const name = el('register-name').value.trim();
  const phone = el('register-phone').value.trim();
  const username = el('register-username').value.trim();
  const plain = el('register-password').value;
  if (!/^08[0-9]{8,11}$/.test(phone)) return notify('Nomor HP salah', 'error');
  const exists = await supabaseClient.from('users').select('id').eq('username', username).single();
  if (exists) return notify('Username dipakai', 'error');
  const pwd = await hash(plain);
  const ref = 'FSM4E-' + rand(100000, 999999);
  await supabaseClient.from('users').insert({ name, phone, username, password: pwd, referral_code: ref });
  notify('Daftar berhasil, silakan login', 'success');
  el('register-form').reset();
  showModal('login-modal');
}

function showDashboard() {
  el('dashboard').classList.remove('hidden');
  loadStreak();
  loadSpin();
  loadProducts();
  loadChat();
  if (currentUser.is_admin) loadAdminPanel();
}

async function loadStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseClient.from('streaks').select('*').eq('user_id', currentUser.id).single();
  if (!data || data.last_date !== today) streak = data ? data.streak : 0;
  else streak = data.streak;
  el('streak-count').textContent = streak;
}

async function claimStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseClient.from('streaks').select('*').eq('user_id', currentUser.id).single();
  if (data && data.last_date === today) return notify('Sudah klaim hari ini', 'error');
  const bonus = 50 + streak * 5;
  currentUser.coins += bonus;
  await supabaseClient.from('users').update({ coins: currentUser.coins }).eq('id', currentUser.id);
  await supabaseClient.from('streaks').upsert({ user_id: currentUser.id, streak: streak + 1, last_date: today }, { onConflict: 'user_id' });
  notify(`+${bonus} koin streak!`, 'success');
  updateUI();
}

function loadSpin() {
  const last = localStorage.getItem('spin_date');
  const today = new Date().toISOString().slice(0, 10);
  spinToday = last === today;
  drawWheel();
}
function drawWheel() {
  const canvas = el('wheel-canvas'), ctx = canvas.getContext('2d');
  const seg = CONFIG.SPIN_REWARD.length, angle = 2 * Math.PI / seg;
  ctx.clearRect(0, 0, 300, 300);
  CONFIG.SPIN_REWARD.forEach((r, i) => {
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 150, i * angle, (i + 1) * angle);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#4361ee' : '#4cc9f0';
    ctx.fill();
    ctx.save();
    ctx.translate(150, 150);
    ctx.rotate(i * angle + angle / 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(r + ' koin', 80, 10);
    ctx.restore();
  });
}
el('spin-btn').onclick = async () => {
  if (spinToday) return notify('Sudah spin hari ini', 'error');
  const deg = rand(0, 360);
  el('wheel-canvas').style.transform = `rotate(${deg + 1440}deg)`;
  el('wheel-canvas').style.transition = 'transform 4s ease-out';
  setTimeout(async () => {
    const idx = Math.floor((360 - (deg % 360)) / (360 / CONFIG.SPIN_REWARD.length)) % CONFIG.SPIN_REWARD.length;
    const prize = CONFIG.SPIN_REWARD[idx];
    currentUser.coins += prize;
    await supabaseClient.from('users').update({ coins: currentUser.coins }).eq('id', currentUser.id);
    localStorage.setItem('spin_date', new Date().toISOString().slice(0, 10));
    notify(`+${prize} koin dari spin!`, 'success');
    updateUI();
    spinToday = true;
  }, 4000);
}

async function loadProducts() {
  const { data } = await supabaseClient.from('products').select('*');
  const list = el('product-list');
  list.innerHTML = '';
  data.forEach(p => {
    const div = document.createElement('div');
    div.className = 'product-item';
    div.innerHTML = `<img src="${p.image_url}" alt="${p.name}" loading="lazy"><h4>${p.name}</h4><p>${p.price} koin</p><button class="btn btn-primary" onclick="buyProduct(${p.id}, '${p.name}', ${p.price})">Beli</button>`;
    list.appendChild(div);
  });
}
async function buyProduct(id, name, price) {
  if (currentUser.coins < price) return notify('Koin tidak cukup', 'error');
  const { data: order, error: insErr } = await supabaseClient
    .from('orders')
    .insert({ user_id: currentUser.id, product_id: id, status: 'pending' })
    .select('id')
    .single();
  if (insErr) return notify('Gagal buat pesanan', 'error');

  currentUser.coins -= price;
  await supabaseClient.from('users').update({ coins: currentUser.coins }).eq('id', currentUser.id);
  updateUI();

  const webhook = `https://discord.com/api/webhooks/${CONFIG.DISCORD_WEBHOOK_ID}/${CONFIG.DISCORD_WEBHOOK_TOKEN}`;
  const embed = {
    embeds: [{
      title: `📦 Pesanan Baru #${order.id}`,
      fields: [
        { name: 'Produk', value: name, inline: true },
        { name: 'Harga', value: `${price} koin`, inline: true },
        { name: 'Pemesan', value: currentUser.name, inline: true },
        { name: 'HP', value: currentUser.phone, inline: true }
      ],
      color: 0x00ff00
    }],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 3,
        label: '✅ Done',
        custom_id: `done_${order.id}`
      }]
    }]
  };
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(embed)
  });

  notify('Pesanan dikirim ke Discord!', 'success');
}

function loadAdminPanel() {
  el('admin-panel').innerHTML = `
    <div class="card glass"><h2>👑 Admin Panel</h2>
      <button class="btn btn-primary" onclick="adminAddProduct()">Tambah Produk</button>
      <button class="btn btn-primary" onclick="adminBroadcast()">Broadcast</button>
      <button class="btn btn-danger" onclick="adminAbuse()">+1k Koin Abuse</button>
      <button class="btn btn-secondary" onclick="toggleDark()">🌙 Dark Mode</button>
    </div>`;
  el('admin-panel').classList.remove('hidden');
}
async function adminAddProduct() {
  const name = prompt('Nama Produk');
  const price = +prompt('Harga (koin)');
  const img = prompt('URL Gambar');
  if (!name || !price || !img) return;
  await supabaseClient.from('products').insert({ name, price, image_url: img });
  notify('Produk ditambahkan', 'success');
  loadProducts();
}
async function adminBroadcast() {
  const msg = prompt('Pesan broadcast');
  if (!msg) return;
  await supabaseClient.from('chat_messages').insert({ user_id: currentUser.id, message: msg, is_broadcast: true });
  showBroadcast(msg, currentUser.name);
}
async function adminAbuse() {
  currentUser.coins += 1000;
  await supabaseClient.from('users').update({ coins: currentUser.coins }).eq('id', currentUser.id);
  updateUI();
  notify('+1000 koin abuse', 'success');
}
function toggleDark() {
  document.body.classList.toggle('dark-mode');
}

async function sendChatMessage() {
  const input = el('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  await supabaseClient.from('chat_messages').insert({ user_id: currentUser.id, message: msg });
  input.value = '';
  loadChat();
}
async function loadChat() {
  const { data } = await supabaseClient.from('chat_messages').select('*, users(name, rank)').order('sent_at', { ascending: true }).limit(50);
  const box = el('chat-messages');
  box.innerHTML = data.map(m => `<div><strong>${m.users.name}:</strong> ${m.message}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}
el('send-chat-btn').onclick = sendChatMessage;
el('chat-input').onkeypress = e => e.key === 'Enter' && sendChatMessage();
el('chat-toggle').onclick = () => el('chat-container').classList.toggle('hidden');

el('scan-btn').onclick = openQRScanner;
el('close-scanner').onclick = () => {
  el('qr-scanner-modal').classList.add('hidden');
  const v = el('qr-video');
  if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
};

async function openQRScanner() {
  el('qr-scanner-modal').classList.remove('hidden');
  const video = el('qr-video');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream;
  video.play();
  scanQR(video);
}
function scanQR(video) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const check = () => {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (code) {
        processQR(code.data);
        return;
      }
    }
    requestAnimationFrame(check);
  };
  check();
}
async function processQR(data) {
  const { data: qr } = await supabaseClient.from('qr_codes').select('*').eq('code', data).eq('is_active', true).single();
  if (!qr) return notify('QR tidak valid', 'error');
  currentUser.coins += CONFIG.QR_REWARD;
  await supabaseClient.from('users').update({ coins: currentUser.coins }).eq('id', currentUser.id);
  await supabaseClient.from('qr_codes').update({ is_active: false }).eq('id', qr.id);
  notify(`+${CONFIG.QR_REWARD} koin`, 'success');
  updateUI();
  el('qr-result').classList.remove('hidden');
}

function updateUI() {
  el('user-coins').textContent = currentUser.coins;
  el('user-rank').textContent = currentUser.rank;
  el('user-rank-badge').className = `rank-badge rank-${currentUser.rank}`;
}
function notify(msg, type) {
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = msg;
  el('notification-area').appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
function showBroadcast(msg, sender) {
  const div = document.createElement('div');
  div.className = 'broadcast-popup';
  div.innerHTML = `📢 <strong>${sender}:</strong> ${msg}`;
  el('broadcast-area').appendChild(div);
  setTimeout(() => div.remove(), 10000);
}
function showModal(id) {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  el(id).classList.remove('hidden');
}
function hideModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}
async function sendDiscord(msg, type) {
  const url = type === 'redeem' ? `https://discord.com/api/webhooks/${CONFIG.DISCORD_WEBHOOK_ID}/${CONFIG.DISCORD_WEBHOOK_TOKEN}` : CONFIG.DISCORD_LEADERBOARD;
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg }) });
}
el('sound-toggle').onclick = () => {
  soundOn = !soundOn;
  el('sound-toggle').textContent = soundOn ? '🔊 Sound' : '🔇 Mute';
};
el('logout-btn').onclick = () => {
  currentUser = null;
  localStorage.clear();
  location.reload();
};

el('login-form').onsubmit = login;
el('register-form').onsubmit = register;
el('show-register').onclick = e => { e.preventDefault(); showModal('register-modal'); };
el('show-login').onclick = e => { e.preventDefault(); showModal('login-modal'); };
el('claim-streak').onclick = claimStreak;

showModal('login-modal');
