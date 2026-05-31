import { Router } from 'express';

import { optionalAuth, requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import * as ctrl from './catalog.controller.js';

export const catalogRouter: Router = Router();

// Public reads
catalogRouter.get('/categories',        optionalAuth, asyncHandler(ctrl.listCategoriesCtrl));
catalogRouter.get('/toppings',          optionalAuth, asyncHandler(ctrl.listToppingsCtrl));
catalogRouter.get('/products',          optionalAuth, asyncHandler(ctrl.listProductsCtrl));
catalogRouter.get('/products/:id',      optionalAuth, asyncHandler(ctrl.getProductCtrl));
catalogRouter.post('/products/price',   optionalAuth, asyncHandler(ctrl.priceLineCtrl));

// Admin / branch-manager writes
catalogRouter.post('/categories',                 requireAuth, requirePermission('catalog:write'), asyncHandler(ctrl.createCategoryCtrl));
catalogRouter.patch('/categories/:id',            requireAuth, requirePermission('catalog:write'), asyncHandler(ctrl.updateCategoryCtrl));
catalogRouter.delete('/categories/:id',           requireAuth, requirePermission('catalog:write'), asyncHandler(ctrl.deleteCategoryCtrl));

catalogRouter.post('/toppings',                   requireAuth, requirePermission('catalog:write'), asyncHandler(ctrl.createToppingCtrl));

catalogRouter.post('/products',                   requireAuth, requirePermission('catalog:write'), asyncHandler(ctrl.createProductCtrl));
catalogRouter.patch('/products/:id',              requireAuth, requirePermission('catalog:write'), asyncHandler(ctrl.updateProductCtrl));
catalogRouter.delete('/products/:id',             requireAuth, requirePermission('catalog:write'), asyncHandler(ctrl.deleteProductCtrl));
catalogRouter.post('/products/:id/branch-override', requireAuth, requirePermission('catalog:override-branch'), asyncHandler(ctrl.setBranchOverrideCtrl));
