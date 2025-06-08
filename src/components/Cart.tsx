
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  customizations?: string[];
}

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveItem: (id: number) => void;
}

const Cart = ({ isOpen, onClose, items, onUpdateQuantity, onRemoveItem }: CartProps) => {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-pizza-dark-bg border-l border-white/10 animate-fade-in">
        <Card className="h-full bg-transparent border-none rounded-none">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-heading flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-pizza-orange" />
                Your Order
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-auto p-6">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 bg-pizza-card-bg rounded-lg">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{item.name}</h4>
                      {item.customizations && (
                        <p className="text-xs text-muted-foreground">
                          {item.customizations.join(', ')}
                        </p>
                      )}
                      <p className="text-pizza-orange font-semibold">${item.price}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                        className="w-8 h-8 p-0 border-white/20"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 p-0 border-white/20"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(item.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          
          {items.length > 0 && (
            <div className="border-t border-white/10 p-6 space-y-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span className="text-pizza-orange">${total.toFixed(2)}</span>
              </div>
              <Button className="w-full bg-pizza-orange hover:bg-pizza-orange/90 text-white py-3">
                Proceed to Checkout
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Cart;
