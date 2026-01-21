import { Link } from 'react-router-dom';
import { useState } from 'react';

interface HeaderProps {
  cartCount?: number;
  onSearch?: (keyword: string) => void;
}

export default function Header({ cartCount = 0, onSearch }: HeaderProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    }
  };

  return (
    <header>
      <div className="header-top">
        <Link to="/" className="logo">
          🚗 AutoParts Shop
        </Link>

        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="車用品を検索（タイヤ、オイル、カスタムパーツなど）"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit">🔍</button>
        </form>

        <nav className="header-nav">
          <Link to="/" className="nav-link">
            ホーム
          </Link>
          <Link to="/cart" className="nav-link">
            🛒 カート
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
        </nav>
      </div>

      <div className="header-sub">
        <Link to="/category/Tires">タイヤ・ホイール</Link>
        <Link to="/category/Oil">オイル・ケミカル</Link>
        <Link to="/category/Interior">内装パーツ</Link>
        <Link to="/category/Exterior">外装パーツ</Link>
        <Link to="/category/Electronics">電装品</Link>
        <Link to="/category/Maintenance">メンテナンス</Link>
        <Link to="/category/Accessories">アクセサリー</Link>
      </div>
    </header>
  );
}
