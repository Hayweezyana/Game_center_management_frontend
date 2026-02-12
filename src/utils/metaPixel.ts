export const trackPageView = () => {
  if (window.fbq) {
    window.fbq('track', 'PageView');
  }
};

export const trackAddToCart = (item: {
  id: string;
  title: string;
  price: number;
  quantity: number;
}) => {
  if (!window.fbq) return;

  window.fbq('track', 'AddToCart', {
    content_name: item.title,
    content_ids: [item.id],
    content_type: 'product',
    value: item.price * item.quantity,
    currency: 'NGN'
  });
};

export const trackInitiateCheckout = (
  total: number,
  cartItems: any[]
) => {
  if (!window.fbq) return;

  window.fbq('track', 'InitiateCheckout', {
    value: total,
    currency: 'NGN',
    contents: cartItems.map(i => ({
      id: i.id,
      quantity: i.quantity
    })),
    num_items: cartItems.length
  });
};

export const trackPurchase = (
  total: number,
  cartItems: any[],
  reference?: string
) => {
  if (!window.fbq) return;

  window.fbq('track', 'Purchase', {
    value: total,
    currency: 'NGN',
    transaction_id: reference,
    contents: cartItems.map(i => ({
      id: i.id,
      quantity: i.quantity
    })),
    num_items: cartItems.reduce((a, b) => a + b.quantity, 0)
  });
};
