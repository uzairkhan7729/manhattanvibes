/**
 * Seed script — wipes & repopulates a development database with a realistic
 * starter dataset: 1 tenant, 2 branches, ~6 categories, ~25 products,
 * ~10 toppings, 1 SuperAdmin, 1 BranchManager, 1 Cashier, 1 sample customer,
 * a few notification templates, and a couple of coupons.
 *
 *   npm run seed --workspace=@mv/api
 */
import { Types } from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../infra/logger.js';
import { connectMongo, disconnectMongo } from '../infra/mongo.js';
import { UserModel } from '../modules/auth/models/user.model.js';
import { BranchModel } from '../modules/branches/branch.model.js';
import { CategoryModel } from '../modules/catalog/models/category.model.js';
import { ProductModel } from '../modules/catalog/models/product.model.js';
import { ToppingModel } from '../modules/catalog/models/topping.model.js';
import { hashPassword } from '../shared/utils/password.js';

const TENANT_ID = new Types.ObjectId(env.DEFAULT_TENANT_ID);

async function wipe(): Promise<void> {
  await Promise.all([
    UserModel.deleteMany({ tenantId: TENANT_ID }),
    BranchModel.deleteMany({ tenantId: TENANT_ID }),
    CategoryModel.deleteMany({ tenantId: TENANT_ID }),
    ProductModel.deleteMany({ tenantId: TENANT_ID }),
    ToppingModel.deleteMany({ tenantId: TENANT_ID }),
  ]);
  logger.info('seed: existing data wiped');
}

async function seedBranches(): Promise<{ guj1: Types.ObjectId }> {
  const guj1 = await BranchModel.create({
    tenantId: TENANT_ID,
    code: 'GUJ-1',
    name: { ar: 'فرع جوجارات', en: 'Gujrat Branch' },
    address: {
      label: 'Flagship', line1: 'GT Road, Gujrat', city: 'Gujrat', district: 'Civil Lines',
      country: 'SA', lat: 32.5736, lng: 74.0779,
    },
    contact: { phone: '+966114000001', email: 'gujrat@manhattanvibes.sa' },
    taxId: '310000000000001',
    zatcaSerialPrefix: 'GUJ1',
    openingHours: [
      { day: 0, open: '11:00', close: '02:00' }, { day: 1, open: '11:00', close: '02:00' },
      { day: 2, open: '11:00', close: '02:00' }, { day: 3, open: '11:00', close: '02:00' },
      { day: 4, open: '11:00', close: '03:00' }, { day: 5, open: '13:00', close: '03:00' },
      { day: 6, open: '13:00', close: '02:00' },
    ],
    features: { dineIn: true, pickup: true, delivery: true, takeaway: true },
    status: 'active',
  });
  logger.info({ guj1: guj1._id.toString() }, 'seed: branches (single)');
  return { guj1: guj1._id };
}

async function seedUsers(branchIds: Types.ObjectId[]): Promise<void> {
  const passwordHash = await hashPassword('ChangeMe!2026');
  await UserModel.create([
    {
      tenantId: TENANT_ID, type: 'staff', role: 'SuperAdmin',
      fullName: { en: 'Codlight Admin', ar: 'مدير كودلايت' },
      phone: { countryCode: '+966', number: '500000001' },
      email: 'admin@manhattanvibes.sa', passwordHash,
      branchIds: [],
      preferredLanguage: 'ar', status: 'active', emailVerified: true, phoneVerified: true,
    },
    {
      tenantId: TENANT_ID, type: 'staff', role: 'BranchManager',
      fullName: { en: 'Ahmed Manager', ar: 'أحمد المدير' },
      phone: { countryCode: '+966', number: '500000002' },
      email: 'manager.ruh1@manhattanvibes.sa', passwordHash,
      branchIds: [branchIds[0]!], preferredLanguage: 'ar', status: 'active', emailVerified: true, phoneVerified: true,
    },
    {
      tenantId: TENANT_ID, type: 'staff', role: 'Cashier',
      fullName: { en: 'Sara Cashier', ar: 'سارة الكاشير' },
      phone: { countryCode: '+966', number: '500000003' },
      email: 'cashier.ruh1@manhattanvibes.sa', passwordHash,
      branchIds: [branchIds[0]!], preferredLanguage: 'ar', status: 'active', emailVerified: true, phoneVerified: true,
    },
    {
      tenantId: TENANT_ID, type: 'customer', role: 'Customer',
      fullName: { en: 'Sample Customer', ar: 'عميل تجريبي' },
      phone: { countryCode: '+966', number: '555000001' },
      email: 'customer@example.com', passwordHash,
      preferredLanguage: 'ar', status: 'active', phoneVerified: true,
      marketingPrefs: { sms: true, email: true, push: true, whatsapp: false },
    },
  ]);
  logger.info('seed: 4 users (admin + manager + cashier + customer; password "ChangeMe!2026")');
}

async function seedCatalog(): Promise<void> {
  const cats = await CategoryModel.insertMany([
    { tenantId: TENANT_ID, name: { ar: 'بيتزا', en: 'Pizza' },      slug: 'pizza',     displayOrder: 1 },
    { tenantId: TENANT_ID, name: { ar: 'برجر', en: 'Burgers' },     slug: 'burgers',   displayOrder: 2 },
    { tenantId: TENANT_ID, name: { ar: 'سلطات', en: 'Salads' },     slug: 'salads',    displayOrder: 3 },
    { tenantId: TENANT_ID, name: { ar: 'مقبلات', en: 'Sides' },     slug: 'sides',     displayOrder: 4 },
    { tenantId: TENANT_ID, name: { ar: 'مشروبات', en: 'Drinks' },   slug: 'drinks',    displayOrder: 5 },
    { tenantId: TENANT_ID, name: { ar: 'حلويات', en: 'Desserts' },  slug: 'desserts',  displayOrder: 6 },
  ]);
  const byslug = (s: string): Types.ObjectId => cats.find((c) => c.slug === s)!._id;

  // Toppings & sauces — prices in halalas
  const toppings = await ToppingModel.insertMany([
    { tenantId: TENANT_ID, name: { ar: 'صلصة طماطم', en: 'Tomato Sauce' },    category: 'sauce',  basePrice: 0 },
    { tenantId: TENANT_ID, name: { ar: 'صلصة باربكيو', en: 'BBQ Sauce' },     category: 'sauce',  basePrice: 0 },
    { tenantId: TENANT_ID, name: { ar: 'موزاريلا', en: 'Mozzarella' },        category: 'cheese', basePrice: 0 },
    { tenantId: TENANT_ID, name: { ar: 'شيدر', en: 'Cheddar' },               category: 'cheese', basePrice: 500 },
    { tenantId: TENANT_ID, name: { ar: 'بيبروني', en: 'Pepperoni' },          category: 'meat',   basePrice: 800 },
    { tenantId: TENANT_ID, name: { ar: 'دجاج', en: 'Chicken' },               category: 'meat',   basePrice: 700 },
    { tenantId: TENANT_ID, name: { ar: 'لحم بقري', en: 'Beef' },              category: 'meat',   basePrice: 900 },
    { tenantId: TENANT_ID, name: { ar: 'فطر', en: 'Mushrooms' },              category: 'veg',    basePrice: 400 },
    { tenantId: TENANT_ID, name: { ar: 'فلفل', en: 'Bell Peppers' },          category: 'veg',    basePrice: 300 },
    { tenantId: TENANT_ID, name: { ar: 'زيتون', en: 'Olives' },               category: 'veg',    basePrice: 300 },
  ]);
  const tid = (n: string): Types.ObjectId => toppings.find((t) => t.name?.en === n)!._id;

  await ProductModel.insertMany([
    // Pizzas (configurable)
    {
      tenantId: TENANT_ID, sku: 'PIZ-MV-CLASSIC', categoryId: byslug('pizza'),
      name: { ar: 'بيتزا مانهاتن الكلاسيكية', en: 'Manhattan Classic Pizza' },
      description: { en: 'Signature blend with mozzarella and tomato' },
      type: 'configurable', basePrice: 3500,
      sizes: [
        { code: 'S', priceDelta: 0, maxToppings: 4 },
        { code: 'M', priceDelta: 1000, maxToppings: 6 },
        { code: 'L', priceDelta: 2000, maxToppings: 8 },
        { code: 'XL', priceDelta: 3000, maxToppings: 10 },
      ],
      crusts: [
        { code: 'classic', name: { en: 'Classic' }, priceDelta: 0 },
        { code: 'thin',    name: { en: 'Thin' },    priceDelta: 0 },
        { code: 'stuffed', name: { en: 'Cheese Stuffed' }, priceDelta: 700 },
      ],
      sauces: [tid('Tomato Sauce'), tid('BBQ Sauce')],
      toppings: [tid('Pepperoni'), tid('Chicken'), tid('Beef'), tid('Mushrooms'), tid('Bell Peppers'), tid('Olives')],
      isVeg: false, allergens: ['gluten', 'dairy'], spicyLevel: 0, vatRate: 15, isActive: true,
    },
    {
      tenantId: TENANT_ID, sku: 'PIZ-MV-VEGGIE', categoryId: byslug('pizza'),
      name: { ar: 'بيتزا الخضار', en: 'Veggie Garden Pizza' },
      type: 'configurable', basePrice: 3200,
      sizes: [{ code: 'M', priceDelta: 0, maxToppings: 6 }, { code: 'L', priceDelta: 1500, maxToppings: 8 }],
      crusts: [{ code: 'classic', name: { en: 'Classic' }, priceDelta: 0 }, { code: 'thin', name: { en: 'Thin' }, priceDelta: 0 }],
      sauces: [tid('Tomato Sauce')],
      toppings: [tid('Mushrooms'), tid('Bell Peppers'), tid('Olives')],
      isVeg: true, allergens: ['gluten', 'dairy'], spicyLevel: 0, isActive: true,
    },
    // Burgers (simple)
    { tenantId: TENANT_ID, sku: 'BUR-MV-CHEESE', categoryId: byslug('burgers'), name: { ar: 'تشيز برجر', en: 'Manhattan Cheeseburger' }, type: 'simple', basePrice: 2800, isVeg: false, allergens: ['gluten', 'dairy'], isActive: true },
    { tenantId: TENANT_ID, sku: 'BUR-MV-DOUBLE', categoryId: byslug('burgers'), name: { ar: 'دبل برجر', en: 'Double Stack Burger' }, type: 'simple', basePrice: 3800, isActive: true },
    { tenantId: TENANT_ID, sku: 'BUR-MV-CHICKEN', categoryId: byslug('burgers'), name: { ar: 'برجر دجاج', en: 'Crispy Chicken Burger' }, type: 'simple', basePrice: 2600, isActive: true },
    // Salads
    { tenantId: TENANT_ID, sku: 'SAL-CAESAR', categoryId: byslug('salads'), name: { en: 'Caesar Salad', ar: 'سيزر' }, type: 'simple', basePrice: 2200, isVeg: true, isActive: true },
    { tenantId: TENANT_ID, sku: 'SAL-GREEK',  categoryId: byslug('salads'), name: { en: 'Greek Salad', ar: 'يوناني' }, type: 'simple', basePrice: 2200, isVeg: true, isActive: true },
    // Sides
    { tenantId: TENANT_ID, sku: 'SID-FRIES', categoryId: byslug('sides'), name: { en: 'Fries', ar: 'بطاطس' }, type: 'simple', basePrice: 900, isVeg: true, isActive: true },
    { tenantId: TENANT_ID, sku: 'SID-WINGS', categoryId: byslug('sides'), name: { en: 'Chicken Wings (6 pc)', ar: 'أجنحة دجاج' }, type: 'simple', basePrice: 1900, isActive: true },
    { tenantId: TENANT_ID, sku: 'SID-MOZZ',  categoryId: byslug('sides'), name: { en: 'Mozzarella Sticks', ar: 'أصابع موزاريلا' }, type: 'simple', basePrice: 1500, isVeg: true, isActive: true },
    // Drinks
    { tenantId: TENANT_ID, sku: 'DRK-COKE',  categoryId: byslug('drinks'), name: { en: 'Coca-Cola 330ml', ar: 'كوكاكولا' }, type: 'simple', basePrice: 500, isVeg: true, isActive: true },
    { tenantId: TENANT_ID, sku: 'DRK-WATER', categoryId: byslug('drinks'), name: { en: 'Water 500ml', ar: 'ماء' }, type: 'simple', basePrice: 300, isVeg: true, isActive: true },
    { tenantId: TENANT_ID, sku: 'DRK-LEMON', categoryId: byslug('drinks'), name: { en: 'Fresh Lemonade', ar: 'ليمون طازج' }, type: 'simple', basePrice: 1200, isVeg: true, isActive: true },
    // Desserts
    { tenantId: TENANT_ID, sku: 'DES-CHOC',  categoryId: byslug('desserts'), name: { en: 'Chocolate Lava Cake', ar: 'كيكة الشوكولاتة' }, type: 'simple', basePrice: 1800, isVeg: true, isActive: true },
    { tenantId: TENANT_ID, sku: 'DES-CHEESE', categoryId: byslug('desserts'), name: { en: 'Cheesecake', ar: 'تشيز كيك' }, type: 'simple', basePrice: 1800, isVeg: true, isActive: true },
  ]);
  logger.info('seed: 6 categories, 10 toppings, 15 products');
}

async function main(): Promise<void> {
  await connectMongo();
  await wipe();
  const { guj1 } = await seedBranches();
  const branches = { ruh1: guj1, jed1: guj1 };
  await seedUsers([branches.ruh1, branches.jed1]);
  await seedCatalog();
  await disconnectMongo();
  logger.info('seed: complete');
}

void main().catch((err: unknown) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
