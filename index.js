/**
 * index.js
 *
 * Backend entry point for the trading simulation server (Bun).
 *
 * Owns:
 * - Serving static frontend files from the www directory
 * - Exposing backend API routes (e.g. /api/quote, /api/market-status)
 * - Handling communication with external data providers
 * - Providing a secure boundary for API keys
 *
 * Does not own:
 * - Frontend application logic
 * - Portfolio calculations
 * - UI rendering
 *
 * Design Note:
 * This file isolates external data access from the frontend,
 * allowing the system to switch data sources (e.g. REST → WebSocket)
 * without affecting the rest of the application.
 */


const API_KEY = "d7fpushr01qqb8rh69p0d7fpushr01qqb8rh69pg";

const STOCK_UNIVERSE_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

let cachedStockUniverse = null;
let cachedStockUniverseAt = 0;

/**
 * Returns true if a cached stock universe is still fresh enough to reuse.
 */
function hasFreshStockUniverseCache() {
    return (
        cachedStockUniverse !== null &&
        Date.now() - cachedStockUniverseAt < STOCK_UNIVERSE_CACHE_TTL_MS
    );
}

/**
 * Basic symbol filter for a cleaner US stock universe.
 *
 * Keeps:
 * - simple common-stock-like symbols
 *
 * Removes many awkward cases such as:
 * - symbols with dots or slashes
 * - very long symbols
 * - non-alphabetic ticker formats
 */
function isSimpleUsTicker(symbol) {
    return /^[A-Z]{1,5}$/.test(symbol);
}

/**
 * Lightweight sector assignment rules.
 *
 * This is intentionally simple for now.
 * Later you can replace this with real metadata from profile endpoints.
 */
function inferSectorFromDescription(description = "") {
    const text = description.toLowerCase();

    if (text.includes("semiconductor")) return "Semiconductors";
    if (text.includes("software")) return "Technology";
    if (text.includes("bank")) return "Finance";
    if (text.includes("energy") || text.includes("oil")) return "Energy";
    if (text.includes("retail") || text.includes("consumer")) return "Consumer";
    if (text.includes("biotech") || text.includes("pharmaceutical")) return "Healthcare";
    if (text.includes("industrial")) return "Industrials";

    return "Other";
}

/**
 * Lightweight style tagging.
 */
function inferStyle(symbol, description = "") {
    const text = description.toLowerCase();

    const highVolNames = ["NVDA", "TSLA", "AMD", "SMCI", "PLTR", "COIN", "MSTR", "RIVN"];
    if (highVolNames.includes(symbol)) return "high-volatility";

    if (text.includes("bank") || text.includes("energy")) return "defensive";
    if (text.includes("software") || text.includes("semiconductor")) return "growth";

    return "core";
}

/**
 * Builds an automated US-only stock universe using Finnhub symbol data.
 *
 * Design Note:
 * This is server-side so the frontend does not need to make
 * many provider calls or expose selection logic directly.
 */
async function buildAutomatedStockUniverse(limit = 30) {
    const apiUrl = `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${API_KEY}`;
    console.log("Building stock universe from:", apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch stock symbols: HTTP ${response.status}`);
    }

    const symbols = await response.json();

    console.log("Raw US symbols received:", symbols.length);

    const filtered = symbols.filter(item => {
        return (
            item &&
            typeof item.symbol === "string" &&
            typeof item.description === "string" &&
            item.type &&
            item.type.toLowerCase().includes("stock") &&
            isSimpleUsTicker(item.symbol)
        );
    });

    console.log("Filtered common-stock candidates:", filtered.length);

    /**
     * Prefer a mixture of recognisable and more active names.
     * This still remains automated because the candidate pool
     * comes from the API and the final selection uses rules.
     */
    const prioritySymbols = new Set([
        "AAPL", "MSFT", "NVDA", "TSLA", "AMD", "META", "AMZN", "GOOGL",
        "PLTR", "COIN", "SMCI", "MSTR", "NFLX", "UBER", "SHOP",
        "JPM", "XOM", "CVX", "LLY", "JNJ", "BA", "CAT", "NKE", "DIS"
    ]);

    const scored = filtered.map(item => {
        let score = 0;

        if (prioritySymbols.has(item.symbol)) score += 100;
        if (item.description.toLowerCase().includes("semiconductor")) score += 20;
        if (item.description.toLowerCase().includes("technology")) score += 15;
        if (item.description.toLowerCase().includes("software")) score += 15;
        if (item.description.toLowerCase().includes("bank")) score += 10;
        if (item.description.toLowerCase().includes("energy")) score += 10;

        return {
            symbol: item.symbol,
            exchange: "US",
            region: "North America",
            sector: inferSectorFromDescription(item.description),
            style: inferStyle(item.symbol, item.description),
            companyName: item.description,
            score
        };
    });

    scored.sort((a, b) => b.score - a.score);

    const selected = [];
    const sectorCounts = {};

    for (const stock of scored) {
        if (selected.length >= limit) break;

        const sector = stock.sector;
        const count = sectorCounts[sector] || 0;

        /**
         * Prevent one sector from dominating too heavily.
         */
        if (selected.length < limit) {
            for (const stock of scored) {
                if (selected.length >= limit) break;

                if (!selected.includes(stock)) {
                    selected.push(stock);
                }
            }
        }

        selected.push(stock);
        sectorCounts[sector] = count + 1;
    }

    return selected;
}

// Logging for easy debugging
console.log("Server starting on http://localhost:10101");

Bun.serve({
    port: 10101,

    async fetch(request) {
        const url = new URL(request.url);
        console.log("Incoming request:", url.pathname + url.search);

        if (url.pathname === "/api/stock-universe") {
            const limit = Number(url.searchParams.get("limit")) || 30;

            try {
                if (hasFreshStockUniverseCache()) {
                    console.log("Returning cached stock universe");
                    return new Response(JSON.stringify(cachedStockUniverse), {
                        headers: { "Content-Type": "application/json" }
                    });
                }

                const universe = await buildAutomatedStockUniverse(limit);

                cachedStockUniverse = universe;
                cachedStockUniverseAt = Date.now();

                console.log("Generated stock universe:", universe.length);
                console.log("Sample:", universe.slice(0, 5));

                return new Response(JSON.stringify(universe), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (error) {
                console.error("Stock universe generation error:", error);

                return new Response(JSON.stringify({
                    error: "Failed to generate stock universe"
                }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        if (url.pathname === "/api/quote") {
            const symbol = url.searchParams.get("symbol");
            console.log("Symbol received:", symbol);

            if (!symbol) {
                return new Response(JSON.stringify({ error: "Missing symbol" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const apiUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
            console.log("Calling Finnhub:", apiUrl);

            try {
                const response = await fetch(apiUrl);
                const data = await response.json();

                console.log("Finnhub response:", data);

                return new Response(JSON.stringify(data), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (error) {
                console.error("Fetch error:", error);

                return new Response(JSON.stringify({ error: "Failed to fetch from Finnhub" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        if (url.pathname === "/api/market-status") {
            const exchange = url.searchParams.get("exchange") || "US";
            console.log("Exchange received:", exchange);

            const apiUrl = `https://finnhub.io/api/v1/stock/market-status?exchange=${exchange}&token=${API_KEY}`;
            console.log("Calling Finnhub:", apiUrl);

            try {
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    throw new Error(`Finnhub returned HTTP ${response.status}`);
                }

                const data = await response.json();
                console.log("Finnhub market status response:", data);

                return new Response(JSON.stringify(data), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (error) {
                console.error("Market status fetch error:", error);

                return new Response(JSON.stringify({ error: "Failed to fetch market status from Finnhub" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        const path = "www" + (url.pathname === "/" ? "/index.htm" : url.pathname);
        console.log("Serving file:", path);
        return new Response(Bun.file(path));
    }
});