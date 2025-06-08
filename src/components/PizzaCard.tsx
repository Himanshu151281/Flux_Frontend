
import { Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Pizza {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  isVegetarian: boolean;
  isSpicy: boolean;
}

interface PizzaCardProps {
  pizza: Pizza;
  onAddToCart: (pizza: Pizza) => void;
  onCustomize: (pizza: Pizza) => void;
}

const PizzaCard = ({ pizza, onAddToCart, onCustomize }: PizzaCardProps) => {
  return (
    <Card className="group bg-pizza-card-bg border-white/10 hover:border-pizza-orange/50 transition-all duration-300 hover-scale overflow-hidden">
      <div className="relative overflow-hidden">
        <img
          src={pizza.image}
          alt={pizza.name}
          className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {pizza.isVegetarian && (
            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
              Veg
            </span>
          )}
          {pizza.isSpicy && (
            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">
              🌶️ Spicy
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 glass rounded-full px-2 py-1 flex items-center space-x-1">
          <Star className="w-3 h-3 text-yellow-400 fill-current" />
          <span className="text-xs text-white">{pizza.rating}</span>
        </div>
      </div>
      
      <CardContent className="p-6">
        <h3 className="text-xl font-heading font-semibold mb-2 text-white">
          {pizza.name}
        </h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
          {pizza.description}
        </p>
        
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-pizza-orange">
            ${pizza.price}
          </span>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCustomize(pizza)}
              className="border-white/20 hover:border-pizza-orange hover:bg-pizza-orange/10"
            >
              Customize
            </Button>
            <Button
              size="sm"
              onClick={() => onAddToCart(pizza)}
              className="bg-pizza-orange hover:bg-pizza-orange/90 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PizzaCard;
