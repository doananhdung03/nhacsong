import { plainText, validTrack, durationLabel } from './lyrics.mjs';

const $ = id => document.getElementById(id);
const storageKey = 'loi.saved.v1';
let saved = [], results = [], current = null, savedView = false, searchController, searchSerial = 0;
let scrollFrame = 0, scrollTarget = null, lastFrame = 0, scrollPosition = 0;
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) saved = stored.filter(validTrack);
} catch { $('status').textContent = 'Không đọc được bài đã lưu. Bạn vẫn có thể tìm và trình chiếu.'; }

function message(text) { $('status').textContent = text; }
function updateSaved() {
  $('saved-count').textContent = saved.length;
  $('save-button').textContent = saved.some(t => t.id === current?.id) ? '♥ Đã lưu · Bỏ lưu' : '♡ Lưu bài';
}
function setTab(isSaved) {
  savedView = isSaved;
  $('saved-tab').classList.toggle('active', isSaved);
  $('results-tab').classList.toggle('active', !isSaved);
  $('saved-tab').setAttribute('aria-pressed', String(isSaved));
  $('results-tab').setAttribute('aria-pressed', String(!isSaved));
  renderList();
}
function renderList() {
  const tracks = savedView ? saved : results;
  $('results').replaceChildren();
  if (savedView) message(`${saved.length} bài đã lưu trên trình duyệt này.`);
  if (!tracks.length) {
    const box = document.createElement('div'); box.className = 'empty';
    const icon = document.createElement('span'); icon.className = 'empty-icon'; icon.textContent = '♫';
    const title = document.createElement('h3'); title.textContent = savedView ? 'Giữ lại những bài bạn yêu' : 'Chưa có bài hát trong danh sách';
    const tip = document.createElement('p'); tip.textContent = savedView ? 'Mở một bài và chọn “Lưu bài” để thêm vào đây.' : 'Thử tên bài khác, tên ca sĩ hoặc tên không dấu.';
    box.append(icon, title, tip); $('results').append(box); return;
  }
  for (const track of tracks) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'result';
    button.classList.toggle('selected', track.id === current?.id);
    button.setAttribute('aria-pressed', String(track.id === current?.id));
    const icon = document.createElement('span'); icon.className = 'song-icon'; icon.textContent = '♪';
    const info = document.createElement('span'); info.className = 'result-info';
    const name = document.createElement('strong'); name.textContent = track.trackName;
    const artist = document.createElement('small'); artist.textContent = [track.artistName, durationLabel(track.duration)].filter(Boolean).join(' · ');
    const badge = document.createElement('span'); badge.className = 'result-badge';
    badge.textContent = track.instrumental ? 'Không lời' : track.syncedLyrics ? 'Có mốc thời gian' : plainText(track) ? 'Lời bài hát' : 'Chưa có lời';
    info.append(name, artist); button.append(icon, info, badge);
    button.addEventListener('click', () => selectTrack(track)); $('results').append(button);
  }
}
function selectTrack(track) {
  stopScroll(); current = track;
  $('reader-empty').hidden = true; $('song-view').hidden = false;
  $('song-title').textContent = track.trackName; $('song-artist').textContent = track.artistName;
  $('song-album').textContent = track.albumName ? `Album: ${track.albumName}` : '';
  $('lyrics').textContent = plainText(track) || 'Chưa có lời cho bản thu này. Hãy chọn một kết quả khác.';
  $('lyrics-scroll').scrollTop = 0; updateSaved(); renderList();
  if (window.matchMedia('(max-width: 850px)').matches) $('reader').scrollIntoView({block:'start'});
}
async function search(query) {
  query = query.trim(); if (!query) { $('query').focus(); return; }
  $('query').value = query;
  searchController?.abort(); searchController = new AbortController();
  const controller = searchController, serial = ++searchSerial;
  const timeout = setTimeout(() => controller.abort(), 20000);
  setTab(false); $('search-button').disabled = true;
  $('results').setAttribute('aria-busy', 'true'); message(`Đang tìm “${query}”…`);
  try {
    const url = new URL('https://lrclib.net/api/search'); url.searchParams.set('q', query);
    const response = await fetch(url, {signal: controller.signal, headers:{'Lrclib-Client':'LoiWeb/1.0'}});
    if (response.status === 429) throw new Error('Nguồn lời đang giới hạn lượt tìm. Vui lòng thử lại sau một lúc.');
    if (!response.ok) throw new Error('Nguồn lời tạm thời chưa phản hồi. Vui lòng thử lại.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.');
    if (serial !== searchSerial) return;
    results = data.filter(validTrack);
    if (!savedView) { renderList(); message(results.length ? `${results.length} bản thu cho “${query}” · Chọn bản phù hợp với bạn` : `Chưa tìm thấy “${query}”. Thử tên không dấu hoặc thêm tên ca sĩ.`); }
  } catch (error) {
    if (serial !== searchSerial) return;
    if (!savedView) message(error.name === 'AbortError' ? 'Kết nối quá lâu. Vui lòng tìm lại.' : error instanceof TypeError ? 'Không kết nối được nguồn lời. Kiểm tra mạng rồi thử lại.' : error.message);
  } finally {
    clearTimeout(timeout);
    if (serial === searchSerial) { $('search-button').disabled = false; $('results').setAttribute('aria-busy','false'); }
  }
}
function stopScroll() {
  cancelAnimationFrame(scrollFrame); scrollTarget = null; lastFrame = 0;
  for (const id of ['scroll-button','present-scroll-button']) { $(id).textContent = '▷ Tự cuộn'; $(id).setAttribute('aria-pressed','false'); }
}
function toggleScroll(target, button, speed) {
  if (scrollTarget === target) { stopScroll(); return; }
  stopScroll(); scrollTarget = target; scrollPosition = target.scrollTop;
  button.textContent = 'Ⅱ Dừng cuộn'; button.setAttribute('aria-pressed','true');
  function tick(now) {
    if (!scrollTarget) return;
    if (lastFrame) {
      scrollPosition += Math.min(now-lastFrame, 100) / 1000 * Number(speed.value);
      target.scrollTop = scrollPosition;
    }
    lastFrame = now;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 1) stopScroll();
    else scrollFrame = requestAnimationFrame(tick);
  }
  scrollFrame = requestAnimationFrame(tick);
}
$('search-form').addEventListener('submit', event => { event.preventDefault(); search($('query').value); });
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => search(button.dataset.query)));
$('results-tab').addEventListener('click', () => { setTab(false); message(results.length ? `${results.length} kết quả tìm kiếm gần nhất.` : 'Nhập tên bài hoặc ca sĩ để bắt đầu.'); });
$('saved-tab').addEventListener('click', () => setTab(true));
$('save-button').addEventListener('click', () => {
  if (!current) return;
  const next = saved.some(t => t.id === current.id) ? saved.filter(t => t.id !== current.id) : [...saved, current];
  try { localStorage.setItem(storageKey, JSON.stringify(next)); saved = next; updateSaved(); if (savedView) renderList(); }
  catch { message('Không lưu được trên trình duyệt này. Có thể bộ nhớ đã đầy hoặc đang bị chặn.'); }
});
$('font-size').addEventListener('input', () => $('lyrics').style.fontSize = `${$('font-size').value}px`);
$('scroll-button').addEventListener('click', () => toggleScroll($('lyrics-scroll'),$('scroll-button'),$('scroll-speed')));
$('present-scroll-button').addEventListener('click', () => toggleScroll($('present-viewport'),$('present-scroll-button'),$('present-speed')));
for (const id of ['lyrics-scroll','present-viewport']) {
  $(id).addEventListener('wheel', stopScroll, {passive:true}); $(id).addEventListener('touchstart', stopScroll, {passive:true});
}
$('present-button').addEventListener('click', () => {
  if (!current) return; stopScroll();
  $('present-title').textContent = current.trackName; $('present-artist').textContent = current.artistName;
  $('present-lyrics').textContent = plainText(current) || 'Chưa có lời cho bản thu này.';
  $('presentation').showModal(); $('present-viewport').scrollTop = 0;
});
$('close-presentation').addEventListener('click', () => $('presentation').close());
$('presentation').addEventListener('close', () => { stopScroll(); if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); });
$('presentation').addEventListener('keydown', event => {
  if (event.code === 'Space' && !['INPUT','BUTTON'].includes(event.target.tagName)) { event.preventDefault(); $('present-scroll-button').click(); }
  if (['ArrowUp','ArrowDown','PageUp','PageDown'].includes(event.code) && event.target.tagName !== 'INPUT') {
    event.preventDefault(); stopScroll(); $('present-viewport').scrollBy({top:(event.code.endsWith('Up') ? -1 : 1) * (event.code.startsWith('Page') ? 400 : 90)});
  }
});
$('present-size').addEventListener('input', () => $('present-lyrics').style.fontSize = `${$('present-size').value}px`);
if (!$('presentation').requestFullscreen) $('fullscreen-button').hidden = true;
$('fullscreen-button').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('presentation').requestFullscreen(); }
  catch { $('fullscreen-button').textContent = 'Trình duyệt chưa cho phép'; }
});
document.addEventListener('fullscreenchange', () => $('fullscreen-button').textContent = document.fullscreenElement ? '⛶ Thu nhỏ' : '⛶ Toàn màn hình');
document.addEventListener('visibilitychange', () => { if (document.hidden) stopScroll(); });
updateSaved();
