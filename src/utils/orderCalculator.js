/**
 * Unified calculation system for all orders and bookings.
 * NO hardcoded additions in frontend.
 * NO mismatched calculations.
 */

const calculateOrderTotals = ({ subtotal, hasGst = false, vendorType = 'food', isReferralApplied = false }) => {
  const parsedSubtotal = parseFloat(subtotal || 0);
  
  // 1. Platform Fee / Commission
  // Food: Based on slabs. Salon: Fixed for now or same logic?
  // User example: ₹140 subtotal -> ₹5 fee.
  // Platform fee disabled
  const platformFee = 0;
  {/*let platformFee = 0;
  if (parsedSubtotal > 0 && !isReferralApplied) {
    if (parsedSubtotal < 200) platformFee = 5;
    else if (parsedSubtotal <= 500) platformFee = 10;
    else if (parsedSubtotal <= 1000) platformFee = 15;
    else platformFee = 20;
  }*/}

  // 2. Taxes (GST - 5% if applicable)
  // Frontend currently adds 5% tax. Backend creation doesn't.
  // We'll follow the rule: if vendor has GST or it's a platform rule.
  // The user says "taxes (if applicable)".
  const taxRate = 0.05; 
  const tax = hasGst ? Math.round(parsedSubtotal * taxRate * 100) / 100 : 0;

  // 3. Delivery Fee (if applicable)
  // Currently 0 as not specified in existing logic, but placeholder for future.
  const deliveryFee = 0;

  // 4. Final Total
  const finalTotal = parsedSubtotal + platformFee + tax + deliveryFee;

  // Rounding to 2 decimal places to avoid floating point issues
  return {
    subtotal: Math.round(parsedSubtotal * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100
  };
};

module.exports = { calculateOrderTotals };
