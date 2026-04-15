async function getQuote(symbol) {
    const response = await fetch(`/api/quote?symbol=${symbol}`);
    const data = await response.json();
    return data;
}