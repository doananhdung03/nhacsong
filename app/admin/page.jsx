import Admin from '../../components/admin';
import Brand from '../../components/brand';

export const metadata = { title: 'Quản lý bài', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <>
    <header className="topbar"><div className="page-width"><Brand /><span>Quản lý bài</span></div></header>
    <main><Admin /></main>
  </>;
}
