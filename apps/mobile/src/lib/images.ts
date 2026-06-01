/**
 * Centralised food imagery — mirrors apps/web's images map. All via Unsplash
 * CDN, served as JPEG over HTTPS. Compatible with expo-image's caching.
 */

const u = (id: string, w = 1000, q = 80): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=${q}`;

export const PRODUCT_IMAGES: Record<string, string> = {
  'PIZ-MV-CLASSIC':  u('photo-1565299624946-b28f40a0ae38'),
  'PIZ-MV-VEGGIE':   u('photo-1604068549290-dea0e4a305ca'),
  'BUR-MV-CHEESE':   u('photo-1568901346375-23c9450c58cd'),
  'BUR-MV-DOUBLE':   u('photo-1571091718767-18b5b1457add'),
  'BUR-MV-CHICKEN':  u('photo-1606755962773-d324e0a13086'),
  'SAL-CAESAR':      u('photo-1546793665-c74683f339c1'),
  'SAL-GREEK':       u('photo-1551248429-40975aa4de74'),
  'SID-FRIES':       u('photo-1573080496219-bb080dd4f877'),
  'SID-WINGS':       u('photo-1608039755401-742074f0548d'),
  'SID-MOZZ':        u('photo-1531749668029-2db88e4276c7'),
  'DRK-COKE':        u('photo-1554866585-cd94860890b7'),
  'DRK-WATER':       u('photo-1548839140-29a749e1cf4d'),
  'DRK-LEMON':       u('photo-1497534446932-c925b458314e'),
  'DES-CHOC':        u('photo-1606313564200-e75d5e30476c'),
  'DES-CHEESE':      u('photo-1533134242443-d4fd215305ad'),
};

export const CATEGORY_IMAGES: Record<string, string> = {
  pizza:    u('photo-1513104890138-7c749659a591'),
  burgers:  u('photo-1572802419224-296b0aeee0d9'),
  salads:   u('photo-1540420773420-3366772f4999'),
  sides:    u('photo-1639024471283-03518883512d'),
  drinks:   u('photo-1622597467836-f3285f2131b8'),
  desserts: u('photo-1551024506-0bccd828d307'),
};

const GENERIC = u('photo-1513104890138-7c749659a591');

export function productImage(sku?: string, categorySlug?: string): string {
  if (sku && PRODUCT_IMAGES[sku]) return PRODUCT_IMAGES[sku];
  if (categorySlug && CATEGORY_IMAGES[categorySlug]) return CATEGORY_IMAGES[categorySlug];
  return GENERIC;
}

export const HERO = {
  pizza:   u('photo-1513104890138-7c749659a591', 1800, 85),
  burger:  u('photo-1571091718767-18b5b1457add', 1800, 85),
  builder: u('photo-1565299624946-b28f40a0ae38', 1800, 85),
  kitchen: u('photo-1542367592-8849eb950fd8', 1600),
};
