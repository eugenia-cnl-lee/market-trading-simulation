async function getQuote(symbol) {
    const response = await fetch(`/api/quote?symbol=${symbol}`);
    const data = await response.json();
    return data;
}

async function getQuotes(symbols) {
    const quotes = {};

    for (const symbol of symbols) {
        quotes[symbol] = await getQuote(symbol);
    }

    return quotes;
}