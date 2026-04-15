async function loadQuote() {
    const data = await getQuote("AAPL");
    renderQuote("AAPL", data);
}

document.getElementById("refresh-btn").addEventListener("click", loadQuote);

loadQuote();