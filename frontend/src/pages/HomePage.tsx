import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { getProducts, addToCart } from '../utils/api';
import type { Product } from '../types';

const USER_ID = 'demo-user-001'; // デモ用の固定ユーザーID

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      setError('商品の読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(USER_ID, productId, 1);
      alert('カートに追加しました！');
    } catch (err) {
      alert('カートへの追加に失敗しました');
      console.error(err);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <main>
      <div style={{
        background: 'linear-gradient(135deg, #1A1A1A 0%, #2C2C2C 100%)',
        padding: '40px 20px',
        marginBottom: '30px',
        borderRadius: '8px',
        color: 'white'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>🚗 車用品専門通販サイト</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>タイヤ、オイル、カスタムパーツなど豊富な品揃え</p>
      </div>

      <h2 style={{ fontSize: '24px', marginBottom: '20px', borderLeft: '4px solid var(--amazon-orange)', paddingLeft: '12px' }}>
        おすすめ商品
      </h2>

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          商品がありません
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard
              key={product.productId}
              product={product}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      )}
    </main>
  );
}
