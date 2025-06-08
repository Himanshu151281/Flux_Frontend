
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface Pizza {
  id: number;
  name: string;
  price: number;
  image: string;
}

interface PizzaCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  pizza: Pizza | null;
  onAddToCart: (pizza: Pizza, customizations: string[], totalPrice: number) => void;
}

const toppings = [
  { id: 'pepperoni', name: 'Pepperoni', price: 2.50 },
  { id: 'mushrooms', name: 'Mushrooms', price: 1.50 },
  { id: 'olives', name: 'Black Olives', price: 1.50 },
  { id: 'peppers', name: 'Bell Peppers', price: 1.50 },
  { id: 'onions', name: 'Red Onions', price: 1.00 },
  { id: 'cheese', name: 'Extra Cheese', price: 2.00 },
  { id: 'bacon', name: 'Bacon', price: 3.00 },
  { id: 'chicken', name: 'Grilled Chicken', price: 3.50 },
];

const sizes = [
  { id: 'small', name: 'Small (10")', multiplier: 0.8 },
  { id: 'medium', name: 'Medium (12")', multiplier: 1.0 },
  { id: 'large', name: 'Large (14")', multiplier: 1.3 },
  { id: 'xlarge', name: 'X-Large (16")', multiplier: 1.6 },
];

const PizzaCustomizer = ({ isOpen, onClose, pizza, onAddToCart }: PizzaCustomizerProps) => {
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState('medium');

  if (!isOpen || !pizza) return null;

  const currentSize = sizes.find(s => s.id === selectedSize) || sizes[1];
  const toppingsPrice = selectedToppings.reduce((sum, toppingId) => {
    const topping = toppings.find(t => t.id === toppingId);
    return sum + (topping?.price || 0);
  }, 0);
  const totalPrice = (pizza.price * currentSize.multiplier) + toppingsPrice;

  const handleToppingChange = (toppingId: string, checked: boolean) => {
    if (checked) {
      setSelectedToppings([...selectedToppings, toppingId]);
    } else {
      setSelectedToppings(selectedToppings.filter(id => id !== toppingId));
    }
  };

  const handleAddToCart = () => {
    const customizations = [
      currentSize.name,
      ...selectedToppings.map(id => toppings.find(t => t.id === id)?.name || '')
    ].filter(Boolean);
    
    onAddToCart(pizza, customizations, totalPrice);
    setSelectedToppings([]);
    setSelectedSize('medium');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-pizza-card-bg border-white/10 animate-scale-in">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-heading">Customize {pizza.name}</CardTitle>
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
        
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <img
              src={pizza.image}
              alt={pizza.name}
              className="w-24 h-24 object-cover rounded-lg"
            />
            <div>
              <h3 className="text-lg font-semibold text-white">{pizza.name}</h3>
              <p className="text-2xl font-bold text-pizza-orange">${totalPrice.toFixed(2)}</p>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-3 text-white">Size</h4>
            <div className="grid grid-cols-2 gap-3">
              {sizes.map((size) => (
                <Label
                  key={size.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSize === size.id
                      ? 'border-pizza-orange bg-pizza-orange/10'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="size"
                    value={size.id}
                    checked={selectedSize === size.id}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-white">{size.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ${(pizza.price * size.multiplier).toFixed(2)}
                    </div>
                  </div>
                </Label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-3 text-white">Extra Toppings</h4>
            <div className="grid grid-cols-2 gap-3">
              {toppings.map((topping) => (
                <Label
                  key={topping.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-white/20 hover:border-white/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedToppings.includes(topping.id)}
                    onCheckedChange={(checked) => handleToppingChange(topping.id, !!checked)}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-white">{topping.name}</div>
                    <div className="text-sm text-muted-foreground">+${topping.price}</div>
                  </div>
                </Label>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/20 hover:border-white/40"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToCart}
              className="flex-1 bg-pizza-orange hover:bg-pizza-orange/90 text-white"
            >
              Add to Cart - ${totalPrice.toFixed(2)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PizzaCustomizer;
