import { apiGet } from '@/lib/api';
import { MenuClient } from './menu-client';

interface Category { _id: string; name: { en: string; ar?: string }; slug: string; displayOrder: number }
interface Product {
  id: string; sku: string; name: { en: string; ar?: string };
  effectivePrice: number; isAvailable: boolean; type: 'simple' | 'configurable' | 'combo';
  categoryId: string; isVeg?: boolean; spicyLevel?: number;
  sizes?: Array<{ code: 'S' | 'M' | 'L' | 'XL'; priceDelta: number; maxToppings?: number }>;
  crusts?: Array<{ code: string; name: { en: string }; priceDelta: number }>;
}
interface Branch { _id: string; code: string; name: { en: string }; status: string }

export default async function MenuPage(): Promise<JSX.Element> {
  const [cats, products, branches] = await Promise.all([
    apiGet<{ items: Category[] }>('/catalog/categories'),
    apiGet<{ items: Product[] }>('/catalog/products?limit=500'),
    apiGet<{ items: Branch[] }>('/branches'),
  ]);
  return (
    <MenuClient
      categories={cats.items.sort((a, b) => a.displayOrder - b.displayOrder)}
      products={products.items}
      branches={branches.items.filter((b) => b.status === 'active')}
    />
  );
}
