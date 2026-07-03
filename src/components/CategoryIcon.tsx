import { memo } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';

interface CategoryIconProps extends Omit<LucideProps, 'ref'> {
  name?: string | null;
  fallback?: LucideIcon;
}

/**
 * Renders any Lucide icon by its PascalCase name (e.g. "ShoppingBag").
 * Falls back to the provided fallback icon (or Package) if the name is missing/invalid.
 */
const CategoryIcon = memo(({ name, fallback, ...props }: CategoryIconProps) => {
  const Fallback = fallback || (Icons.Package as LucideIcon);
  if (!name) return <Fallback {...props} />;
  const Found = (Icons as unknown as Record<string, LucideIcon>)[name];
  const IconComp = Found || Fallback;
  return <IconComp {...props} />;
});

CategoryIcon.displayName = 'CategoryIcon';
export default CategoryIcon;

// Curated list of icons admins can pick from for categories.
// PascalCase names matching lucide-react exports.
export const CATEGORY_ICON_OPTIONS: string[] = [
  'Smartphone', 'Phone', 'Headphones', 'Watch', 'Camera', 'Laptop', 'Monitor', 'Tablet', 'Tv',
  'Gamepad2', 'Mouse', 'Keyboard', 'HardDrive', 'Battery', 'Plug', 'Cable', 'Cpu',
  'Shirt', 'ShoppingBag', 'ShoppingCart', 'Footprints', 'Glasses', 'Watch as Watch2', 'Crown', 'Gem',
  'CookingPot', 'Utensils', 'UtensilsCrossed', 'Coffee', 'CupSoda', 'Soup', 'IceCream', 'Pizza',
  'Refrigerator', 'Microwave', 'WashingMachine', 'Lamp', 'Sofa', 'Bed', 'Armchair',
  'Baby', 'Bike', 'Car', 'Bus', 'Plane', 'Truck', 'Wrench', 'Hammer',
  'Heart', 'Star', 'Sparkles', 'Gift', 'Tag', 'Percent', 'Flame', 'Zap',
  'Book', 'BookOpen', 'GraduationCap', 'Pencil', 'PenTool', 'Palette', 'Music', 'Headset',
  'Dog', 'Cat', 'Flower', 'Leaf', 'TreePine', 'Sun', 'Cloud', 'Droplet',
  'Dumbbell', 'Activity', 'Trophy', 'Medal', 'Volleyball', 'Tent', 'Mountain', 'Compass',
  'Pill', 'Stethoscope', 'Syringe', 'HeartPulse', 'Bandage',
  'Home', 'Store', 'Building2', 'Briefcase', 'Package', 'Boxes', 'Layers', 'Grid3x3',
].filter((v, i, a) => a.indexOf(v) === i && !v.includes(' ')); // dedupe + remove the bad alias entry
