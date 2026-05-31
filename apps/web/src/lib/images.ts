/**
 * Centralized food imagery (Unsplash CDN). Mapping is by product SKU first
 * (specific) then by category slug (fallback). All URLs are direct CDN URLs
 * served via next/image for optimization.
 *
 * Photo credits: Unsplash photographers. Free for commercial use under the
 * Unsplash License. (https://unsplash.com/license)
 */

const u = (id: string, w = 1200, q = 80): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=${q}`;

/** Per-product image by SKU. Add more as the catalog grows. */
export const PRODUCT_IMAGES: Record<string, string> = {
  'PIZ-MV-CLASSIC':  u('photo-1565299624946-b28f40a0ae38'),                     // pepperoni overhead
  'PIZ-MV-VEGGIE':   u('photo-1604068549290-dea0e4a305ca'),                     // veggie pizza
  'BUR-MV-CHEESE':   u('photo-1568901346375-23c9450c58cd'),                     // cheeseburger
  'BUR-MV-DOUBLE':   u('photo-1571091718767-18b5b1457add'),                     // double stack
  'BUR-MV-CHICKEN':  u('photo-1606755962773-d324e0a13086'),                     // chicken burger
  'SAL-CAESAR':      u('photo-1546793665-c74683f339c1'),                        // caesar salad
  'SAL-GREEK':       u('photo-1551248429-40975aa4de74'),                        // greek salad
  'SID-FRIES':       u('photo-1573080496219-bb080dd4f877'),                     // fries
  'SID-WINGS':       u('photo-1608039755401-742074f0548d'),                     // wings
  'SID-MOZZ':        u('photo-1531749668029-2db88e4276c7'),                     // mozzarella sticks
  'DRK-COKE':        u('photo-1554866585-cd94860890b7'),                        // cola
  'DRK-WATER':       u('photo-1548839140-29a749e1cf4d'),                        // water bottle
  'DRK-LEMON':       u('photo-1497534446932-c925b458314e'),                     // lemonade
  'DES-CHOC':        u('photo-1606313564200-e75d5e30476c'),                     // chocolate lava cake
  'DES-CHEESE':      u('photo-1533134242443-d4fd215305ad'),                     // cheesecake
};

/** Category-slug fallback when no per-product image is set. */
export const CATEGORY_IMAGES: Record<string, string> = {
  pizza:    u('photo-1513104890138-7c749659a591'),
  burgers:  u('photo-1572802419224-296b0aeee0d9'),
  salads:   u('photo-1540420773420-3366772f4999'),
  sides:    u('photo-1639024471283-03518883512d'),
  drinks:   u('photo-1622597467836-f3285f2131b8'),
  desserts: u('photo-1551024506-0bccd828d307'),
};

const GENERIC = u('photo-1513104890138-7c749659a591');                          // pizza closeup

export function productImage(sku?: string, categorySlug?: string): string {
  if (sku && PRODUCT_IMAGES[sku]) return PRODUCT_IMAGES[sku];
  if (categorySlug && CATEGORY_IMAGES[categorySlug]) return CATEGORY_IMAGES[categorySlug];
  return GENERIC;
}

/** Hero / large banner imagery. */
export const HERO_IMAGES = [
  {
    url: u('photo-1513104890138-7c749659a591', 2000, 85),
    headline: 'Manhattan-style pizza,',
    accent: 'delivered hot.',
    sub: 'Hand-tossed dough, real mozzarella, and toppings worth fighting over.',
    ctaLabel: 'Order now',
    ctaHref: '/menu',
  },
  {
    url: u('photo-1571091718767-18b5b1457add', 2000, 85),
    headline: 'Stacked burgers,',
    accent: 'flame-grilled.',
    sub: 'Aged beef, melted cheddar, soft-toasted brioche. Built for hunger.',
    ctaLabel: 'See burgers',
    ctaHref: '/menu',
  },
  {
    url: u('photo-1565299624946-b28f40a0ae38', 2000, 85),
    headline: 'Build your own,',
    accent: 'pizza perfect.',
    sub: 'Pick your crust, sauce, cheese, and a wall of toppings. Designed by you.',
    ctaLabel: 'Build a pizza',
    ctaHref: '/menu',
  },
];

/** Lifestyle imagery for marketing strips. */
export const LIFESTYLE = {
  kitchen:  u('photo-1542367592-8849eb950fd8', 1600),
  delivery: u('photo-1526367790999-0150786686a2', 1600),
  family:   u('photo-1604068549290-dea0e4a305ca', 1600),
};
