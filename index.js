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


function getRegionFromCountry(country) {
    if (country === "US" || country === "CA") {
        return "North America";
    }

    if (!country) {
        return "Unknown";
    }

    return country;
}

function getMarketCapBucket(marketCap) {
    if (!marketCap || marketCap <= 0) {
        return "Unknown";
    }

    if (marketCap >= 10000) {
        return "Large Cap";
    }

    if (marketCap >= 2000) {
        return "Mid Cap";
    }

    return "Small Cap";
}

async function fetchCompanyProfile(symbol) {
    const apiUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_KEY}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`Failed profile fetch for ${symbol}: HTTP ${response.status}`);
    }

    return await response.json();
}


/**
 * Builds an automated US-only stock universe using Finnhub symbol data.
 *
 * Design Note:
 * This is server-side so the frontend does not need to make
 * many provider calls or expose selection logic directly.
 */
async function buildAutomatedStockUniverse(limit = 30) {
    // Fetch US stock lists from both NASDAQ and NYSE
    const urls = [
        `https://finnhub.io/api/v1/stock/symbol?exchange=US&mic=XNAS&token=${API_KEY}`,
        `https://finnhub.io/api/v1/stock/symbol?exchange=US&mic=XNYS&token=${API_KEY}`
    ];

    const symbolResponses = await Promise.all(urls.map(url => fetch(url)));

    for (const response of symbolResponses) {
        if (!response.ok) {
            throw new Error(`Failed to fetch stock symbols: HTTP ${response.status}`);
        }
    }

    const symbolResults = await Promise.all(
        symbolResponses.map(response => response.json())
    );

    const symbols = symbolResults.flat();

    console.log("Combined US symbols (NASDAQ + NYSE):", symbols.length);
    
    // Filter and shortlist
    const filtered = symbols.filter(item => {
        return (
            item &&
            typeof item.symbol === "string" &&
            typeof item.description === "string" &&
            item.type &&
            item.type.toLowerCase().includes("stock") &&
            isSimpleUsTicker(item.symbol) &&
            item.symbol.length <= 4 && // remove weird 5-letter OTC
            !item.symbol.endsWith("F") && // remove OTC foreign shares
            !item.symbol.endsWith("Y") // remove ADR weird shares
        );
    });

    console.log("Filtered common-stock candidates:", filtered.length);

    const shuffled = filtered.sort(() => 0.5 - Math.random());

    const shortlisted = shuffled.slice(0, limit);

    // Enrich shortlisted stocks
    const enriched = await Promise.all(
        shortlisted.map(async item => {
            try {
                const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${item.symbol}&token=${API_KEY}`;
                const profileResponse = await fetch(profileUrl);

                if (!profileResponse.ok) {
                    throw new Error(`Failed profile fetch for ${item.symbol}: HTTP ${profileResponse.status}`);
                }

                const profile = await profileResponse.json();

                return {
                    symbol: item.symbol,
                    companyName: profile.name || item.description,
                    exchange: "US",
                    region: "North America",
                    sector: profile.finnhubIndustry || "Other",
                    style: getMarketCapBucket(profile.marketCapitalization ?? null),
                    marketCap: profile.marketCapitalization ?? null
                };
            } catch (error) {
                console.error(`Profile enrichment failed for ${item.symbol}:`, error.message);

                return {
                    symbol: item.symbol,
                    companyName: item.description,
                    exchange: "US",
                    region: "North America",
                    sector: "Other",
                    style: "Unknown",
                    marketCap: null
                };
            }
        })
    );

    return enriched.filter(Boolean).slice(0, limit);
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