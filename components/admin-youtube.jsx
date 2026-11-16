'use client';

import { useEffect, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

const emptyKeys = [];

export default function AdminYoutube({ session }) {
  const [key, setKey] = useState(''), [info, setInfo] = useState(null), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [revealed, setRevealed] = useState({});
  const token = session.access_token;
  async function api(method = 'GET', body, signal) {
    const response = await fetch('/api/admin/youtube', { method, signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Không lưu được cấu hình.');
    return data;
  }
  useEffect(() => {
    const controller = new AbortController();
    setInfo(null); setRevealed({}); setStatus('Đang tải cấu hình YouTube…');
    api('GET', null, controller.signal).then(data => { setInfo(data); setStatus(''); }).catch(error => { if (!controller.signal.aborted) setStatus(error.message); });
    return () => controller.abort();
  }, [token]);
  async function save(body) {
    setBusy(true);
    try { await api('POST', body); setKey(''); setName(''); setInfo(await api()); setStatus(body.action === 'activate' ? 'Đã chuyển key đang dùng.' : 'Đã thêm key vào danh sách.'); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  async function toggleKey(id) {
    if (revealed[id]) { setRevealed(values => { const next = { ...values }; delete next[id]; return next; }); return; }
    setBusy(true);
    try { const data = await api('POST', { action: 'reveal', id }); setRevealed(values => ({ ...values, [id]: data.key })); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  const table = useReactTable({
    data: info?.keys || emptyKeys,
    getRowId: item => item.id,
    columns: [
      { accessorKey: 'name', header: 'Tên', cell: ({ row }) => <strong>{row.original.name}</strong> },
      { id: 'usage', header: 'Lượt gọi hôm nay', cell: ({ row }) => `${row.original.used || 0} / 100` },
      { id: 'key', header: 'Key', cell: ({ row }) => {
        const item = row.original;
        return <div className="youtube-key-cell">
          <input aria-label={`Key đã lưu: ${item.name}`} readOnly value={revealed[item.id] || '••••••••••••••••••••••••'} onFocus={event => event.target.select()} />
          <button type="button" className="outline" disabled={busy} aria-expanded={Boolean(revealed[item.id])} onClick={() => toggleKey(item.id)}>{revealed[item.id] ? 'Ẩn key' : 'Xem key'}</button>
          {item.active ? <span>Đang dùng</span> : <button type="button" className="outline" disabled={busy} onClick={() => save({ action: 'activate', id: item.id })}>Dùng key này</button>}
        </div>;
      } },
    ],
    getCoreRowModel: getCoreRowModel(),
  });
  return <section className="admin-login" aria-label="Quản lý YouTube">
    <h2>YouTube Karaoke</h2>
    {info && <p>{info.configured ? 'Đã lưu key trong database.' : info.environmentKey ? 'Đang dùng key từ biến môi trường.' : 'Chưa có key YouTube.'}{info.updatedAt && ` Cập nhật: ${new Date(info.updatedAt).toLocaleString('vi-VN')}`}</p>}
    <div className="youtube-key-table-wrap"><table className="youtube-key-table" aria-label="Danh sách key YouTube">
      <thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => <th scope="col" key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
      <tbody>{table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
    </table>{info && !info.keys?.length && <p>Chưa có key trong database.</p>}</div>
    <form onSubmit={event => { event.preventDefault(); save({ action: 'add', key, name }); }}>
      <label htmlFor="youtube-key-name">Tên gợi nhớ</label>
      <input id="youtube-key-name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Key chính" />
      <label htmlFor="youtube-api-key">Thêm key YouTube</label>
      <input id="youtube-api-key" type="password" autoComplete="new-password" required minLength={20} maxLength={200} value={key} onChange={event => setKey(event.target.value)} />
      <div className="search-actions"><button className="primary" disabled={busy || !info || !key.trim() || !name.trim()}>Thêm key YouTube</button>
        {info?.environmentKey && !info.configured && <button type="button" className="outline" disabled={busy} onClick={() => save({ importEnvironment: true })}>Nhập key hiện tại vào database</button>}</div>
    </form>
    <small>Tự chọn key tiếp theo khi đạt 100 lượt gọi từ website. Bộ đếm đặt lại lúc 0 giờ PT; không phải quota thực tế của Google. Các key cùng project vẫn chung quota. Tải lại trang để cập nhật số lượt.</small>
    <p role="status" aria-live="polite">{status}</p>
  </section>;
}
