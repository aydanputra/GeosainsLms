import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL';
  meta?: any;
  imageUrl?: string | null;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateMeta: (id: string, meta: any) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => {
        const type = item.type || 'PHYSICAL';
        const c: any = (globalThis as any).crypto;
        const id = c && typeof c.randomUUID === 'function' ? c.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

        if (type === 'PHYSICAL' && !item.meta) {
          const existing = state.items.find((i) => i.productId === item.productId && (i.type || 'PHYSICAL') === 'PHYSICAL' && !i.meta);
          if (existing) {
            return {
              items: state.items.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i)),
            };
          }
        }

        return { items: [...state.items, { ...item, id, type }] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id),
      })),
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      })),
      updateMeta: (id, meta) => set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, meta } : i)),
      })),
      clearCart: () => set({ items: [] }),
      getTotal: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    }),
    {
      name: 'cart-storage',
      version: 2,
      skipHydration: true,
      migrate: (persisted: any) => {
        const persistedObj = persisted && typeof persisted === 'object' ? persisted : {};
        const state =
          persistedObj && typeof persistedObj.state === 'object' && persistedObj.state
            ? (persistedObj.state as any)
            : persistedObj;
        const items = Array.isArray(state.items) ? state.items : [];
        const c: any = (globalThis as any).crypto;
        const nextItems = items.map((it: any) => {
          const id = typeof it?.id === 'string' && it.id ? it.id : c && typeof c.randomUUID === 'function' ? c.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const type = it?.type === 'SERVICE' || it?.type === 'RENTAL' || it?.type === 'PHYSICAL' ? it.type : 'PHYSICAL';
          const priceRaw = typeof it?.price === 'number' ? it.price : Number(it?.price);
          const quantityRaw = typeof it?.quantity === 'number' ? it.quantity : Number(it?.quantity);
          const price = Number.isFinite(priceRaw) ? priceRaw : 0;
          const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
          const name = typeof it?.name === 'string' ? it.name : String(it?.name || '');
          const productId = typeof it?.productId === 'string' ? it.productId : String(it?.productId || '');
          return { ...it, id, type, price, quantity, name, productId };
        });
        return { ...state, items: nextItems };
      },
    }
  )
);
