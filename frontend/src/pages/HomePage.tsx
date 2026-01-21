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
      <h1 style={{ fontSize: '28px', marginBottom: '20px' }}>おすすめ商品</h1>

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
