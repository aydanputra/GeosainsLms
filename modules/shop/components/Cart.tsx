"use client";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function Cart({ items, onRemove, onCheckout }: { items: CartItem[], onRemove: (id: string) => void, onCheckout: () => void }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) return <div>Your cart is empty</div>;

  return (
    <div className="border rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-4">Cart</h2>
      <ul className="divide-y divide-gray-200">
        {items.map((item) => (
          <li key={item.id} className="py-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-gray-500">${item.price} x {item.quantity}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="font-bold">${item.price * item.quantity}</span>
              <button 
                onClick={() => onRemove(item.id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t pt-4 flex justify-between items-center">
        <span className="text-lg font-bold">Total:</span>
        <span className="text-xl font-bold text-indigo-600">${total}</span>
      </div>
      <button 
        onClick={onCheckout}
        className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold"
      >
        Proceed to Checkout
      </button>
    </div>
  );
}
