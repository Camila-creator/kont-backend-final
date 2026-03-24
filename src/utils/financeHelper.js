/**
 * FINANCE HELPER
 * Centraliza los cálculos de conversión multimoneda.
 */

/**
 * Procesa un monto en dólares y calcula su equivalente nativo según la cuenta.
 * @param {number} amountUSD - El monto que se desea procesar (siempre en moneda base $)
 * @param {number} exchangeRate - La tasa de cambio (ej. 45.50)
 * @param {string} accountCurrency - La moneda de la cuenta financiera ('USD' o 'VES')
 */
const processPaymentMultiCurrency = (amountUSD, exchangeRate, accountCurrency) => {
    const rate = parseFloat(exchangeRate || 1);
    const currency = accountCurrency || 'USD';
    const usd = parseFloat(amountUSD || 0);

    // Si la cuenta es en Bolívares (VES), el monto nativo es USD * Tasa.
    // Si la cuenta es en Dólares, el monto nativo es el mismo monto en USD.
    const amountNative = (currency === 'VES') ? (usd * rate) : usd;

    return {
        amount: usd,            // Valor en $ para el saldo/deuda
        amount_native: amountNative, // Valor real recibido en la moneda de la cuenta
        exchange_rate: rate,    // Tasa aplicada
        currency: currency      // Moneda de la transacción
    };
};

module.exports = { processPaymentMultiCurrency };