const getOrderStatus = async ({ order_number }) => {
    const mockOrders = {
      'ORD-123456': {
        status: 'Shipped',
        estimated_delivery: 'June 10, 2026',
        carrier: 'UPS',
        tracking_number: '1Z999AA10123456784'
      },
      'ORD-789012': {
        status: 'Processing',
        estimated_delivery: 'June 12, 2026',
        carrier: null,
        tracking_number: null
      },
      'ORD-345678': {
        status: 'Delivered',
        delivered_date: 'June 5, 2026',
        carrier: 'FedEx',
        tracking_number: null
      }
    }
  
    const order = mockOrders[order_number.toUpperCase()]
  
    if (!order) {
      return {
        found: false,
        message: `No order found with number ${order_number}. Please check your confirmation email for the correct order number.`
      }
    }
  
    return { found: true, order_number: order_number.toUpperCase(), ...order }
  }
  
  module.exports = { getOrderStatus }