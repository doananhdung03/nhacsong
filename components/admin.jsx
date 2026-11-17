'use client';

import AdminYoutube from './admin-youtube';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { catalogSong, lyricPreview, normalizeSearch, searchCatalog } from '../lib/lyrics.mjs';

// Edit/delete rights are enforced by RLS (supabase/admin.sql), not by this page.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { flowType: 'pkce' } }) : null;
const emptyForm = { id: null, title: '', artist: '', lyrics: '' };

export default function Admin() {
  const [session, setSession] = useState(null), [ready, setReady] = useState(false);
  const [email, setEmail] = useState(''), [status, setStatus] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [songs, setSongs] = useState([]), [filter, setFilter] = useState(''), [form, setForm] = useState(emptyForm), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) loadSongs(); }, [session]);

  async function loadSongs() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('songs').select('id,title,artist,initials,folded,key,lyrics').order('id', { ascending: false }).range(from, from + 999);
      if (error) { setStatus(`Không tải được danh sách: ${error.message}`); return; }
      rows.push(...data);
      if (data.length < 1000) break;
    }
    setSongs(rows);
  }
  async function login(event) {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setStatus(error.code === 'invalid_credentials' ? 'Email hoặc mật khẩu không đúng.' : error.code === 'email_not_confirmed' ? 'Email chưa được xác nhận.' : 'Chưa đăng nhập được. Kiểm tra kết nối và thử lại.');
      } else setPassword('');
    } catch { setStatus('Không kết nối được máy chủ đăng nhập. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  async function changePassword(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setStatus('Mật khẩu xác nhận không khớp.'); return; }
    setBusy(true); setStatus('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) setStatus('Chưa đổi được mật khẩu. Mật khẩu cần đủ mạnh; nếu phiên đã cũ, hãy đăng nhập lại.');
      else { setNewPassword(''); setConfirmPassword(''); setStatus('Đã lưu mật khẩu mới. Bạn có thể dùng email và mật khẩu này để đăng nhập.'); }
    } catch { setStatus('Không kết nối được máy chủ. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    const title = normalizeSearch(form.title), artist = normalizeSearch(form.artist), lyrics = form.lyrics.trim() || null;
    if (!title || !artist) { setStatus('Nhập tên bài và ca sĩ.'); return; }
    // Hand-entered lyrics also become the preview; without lyrics the LRCLIB preview is kept.
    const row = { ...catalogSong(title, artist), lyrics, ...(lyrics && { preview: lyricPreview(lyrics) }) };
    setBusy(true);
    // RLS silently skips rows it refuses on update, so ask for the row back to detect "no permission".
    const { data, error } = form.id ? await supabase.from('songs').update(row).eq('id', form.id).select('id') : await supabase.from('songs').insert(row).select('id');
    setBusy(false);
    if (error || !data?.length) {
      setStatus(error?.code === '23505' ? `“${title} – ${artist}” đã có trong danh sách. Tìm bài đó bên dưới và bấm Sửa.`
        : !error || error.code === '42501' ? 'Tài khoản này không có quyền thêm hoặc sửa bài.' : `Chưa lưu được: ${error.message}`);
      return;
    }
    setStatus(form.id ? `Đã lưu thay đổi cho “${title}”.` : `Đã thêm “${title}”.`); setForm(emptyForm); loadSongs();
  }
  async function remove(song) {
    if (!confirm(`Xóa “${song.title} – ${song.artist}”? Không thể hoàn tác.`)) return;
    const { data, error } = await supabase.from('songs').delete().eq('id', song.id).select('id');
    if (error || !data?.length) { setStatus(error ? `Chưa xóa được: ${error.message}` : 'Tài khoản này không có quyền xóa bài.'); return; }
    setStatus(`Đã xóa “${song.title}”.`); if (form.id === song.id) setForm(emptyForm); loadSongs();
  }
  function edit(song) {
    setForm({ id: song.id, title: song.title, artist: song.artist, lyrics: song.lyrics || '' });
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!supabase) return <p className="notice">Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>;
  if (!ready) return null;
  if (!session) return <section className="admin">
    <h1>Quản lý bài</h1>
    <form className="admin-login" onSubmit={login}>
      <label htmlFor="admin-email">Email quản trị</label><input id="admin-email" type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} />
      <label htmlFor="admin-password">Mật khẩu</label><input id="admin-password" type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
      <div><button className="primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></div>
      <small>Nếu trước đây dùng link email và chưa đặt mật khẩu, hãy đặt mật khẩu cho tài khoản trong Supabase Authentication trước.</small>
    </form>
    {status && <p id="status" role="status">{status}</p>}
  </section>;

  const shown = filter.trim() ? searchCatalog(songs, filter, 50) : songs.slice(0, 50);
  return <section className="admin">
    <div className="admin-head"><h1>Quản lý bài</h1><span>{session.user.email}<button className="outline" onClick={() => supabase.auth.signOut()}>Đăng xuất</button></span></div>
    <details className="admin-login"><summary>Đặt / đổi mật khẩu đăng nhập</summary>
      <form className="admin-password-form" onSubmit={changePassword}>
        <label htmlFor="new-admin-password">Mật khẩu mới</label><input id="new-admin-password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} />
        <label htmlFor="confirm-admin-password">Nhập lại mật khẩu mới</label><input id="confirm-admin-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
        <button className="outline" disabled={busy}>Lưu mật khẩu</button>
      </form>
    </details>
    <AdminYoutube key={session.user.id} session={session} />
    <form className="admin-form" onSubmit={save}>
      <label>Tên bài<input required maxLength={200} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
      <label>Ca sĩ<input required maxLength={200} value={form.artist} onChange={event => setForm({ ...form, artist: event.target.value })} /></label>
      <label className="wide">Lời bài <small>Các đoạn cách nhau bằng một dòng trống. Để trống thì lấy lời từ LRCLIB.</small><textarea rows={12} maxLength={20000} value={form.lyrics} onChange={event => setForm({ ...form, lyrics: event.target.value })} /></label>
      <div className="wide search-actions"><button className="primary" disabled={busy}>{form.id ? 'Lưu thay đổi' : 'Thêm bài'}</button>{form.id && <button type="button" className="outline" onClick={() => setForm(emptyForm)}>Hủy sửa</button>}</div>
    </form>
    <p id="status" role="status" aria-live="polite">{status}</p>
    <div className="admin-filter"><input type="search" placeholder="Lọc theo tên, chữ cái đầu hoặc ca sĩ…" aria-label="Lọc bài" value={filter} onChange={event => setFilter(event.target.value)} /><span>{songs.length.toLocaleString('vi')} bài</span></div>
    <ul className="admin-list">{shown.map(song => <li key={song.id}><strong>{song.title}</strong><span>{song.artist}</span><span className="tag">{song.lyrics ? 'Lời tự nhập' : 'LRCLIB'}</span><button className="outline" onClick={() => edit(song)}>Sửa</button><button className="outline" onClick={() => remove(song)}>Xóa</button></li>)}</ul>
  </section>;
}
