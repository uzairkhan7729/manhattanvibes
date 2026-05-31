export type OrderState =
  | 'CREATED' | 'CONFIRMED' | 'PREPARING' | 'BAKING' | 'READY'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CLOSED' | 'CANCELLED' | 'REFUNDED';

/**
 * Allowed transitions. Validated on every state-changing operation.
 * Keep this table small and explicit — mirrors SDD doc 02 §4.
 */
const transitions: Record<OrderState, OrderState[]> = {
  CREATED:           ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:         ['PREPARING', 'CANCELLED'],
  PREPARING:         ['BAKING', 'READY', 'CANCELLED'],
  BAKING:            ['READY', 'CANCELLED'],
  READY:             ['OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  OUT_FOR_DELIVERY:  ['DELIVERED'],
  DELIVERED:         ['CLOSED'],
  CLOSED:            ['REFUNDED'],
  CANCELLED:         [],
  REFUNDED:          [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return transitions[from].includes(to);
}

export function isTerminal(state: OrderState): boolean {
  return state === 'CANCELLED' || state === 'REFUNDED' || state === 'CLOSED';
}

/** True after kitchen has accepted — used to gate modification windows. */
export function isPastKitchenAccept(state: OrderState): boolean {
  const order: OrderState[] = ['CREATED', 'CONFIRMED', 'PREPARING', 'BAKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
  return order.indexOf(state) >= order.indexOf('PREPARING');
}
