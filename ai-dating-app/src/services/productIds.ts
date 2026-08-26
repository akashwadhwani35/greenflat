/**
 * Store product identifiers. These must match App Store Connect, Google Play
 * Console, and backend/src/services/products.catalog.ts exactly.
 */
export type PackId = '15' | '40' | '95' | '260';
export type PlanTier = 'pro' | 'premium';
export type PlanDuration = '1week' | '1month' | '3month' | '6month';

export const TOKEN_PACK_PRODUCT_IDS: Record<PackId, string> = {
  '15': 'tokens_15',
  '40': 'tokens_40',
  '95': 'tokens_95',
  '260': 'tokens_260',
};

export const subscriptionProductId = (plan: PlanTier, duration: PlanDuration) =>
  `${plan}_${duration}`;

export const ALL_PRODUCT_IDS = [
  ...Object.values(TOKEN_PACK_PRODUCT_IDS),
  ...(['pro', 'premium'] as PlanTier[]).flatMap((plan) =>
    (['1week', '1month', '3month', '6month'] as PlanDuration[]).map((d) =>
      subscriptionProductId(plan, d)
    )
  ),
];
