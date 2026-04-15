function renderQuote(symbol, data) {
    document.getElementById("stock-name").textContent = symbol;
    document.getElementById("price").textContent = `Price: $${data.c.toFixed(2)}`;
    document.getElementById("change").textContent = `Change: ${data.d.toFixed(2)} (${data.dp.toFixed(2)}%)`;
}