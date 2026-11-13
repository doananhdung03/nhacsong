import Admin from '../../components/admin';

export const metadata = { title: 'Quản lý bài · Hồng Lâm', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <>
    <header className="topbar"><div className="page-width"><a href="/" className="brand">ÂM THANH NHẠC SỐNG HỒNG LÂM</a><span>Quản lý bài</span></div></header>
    <main><Admin /></main>
  </>;
}
