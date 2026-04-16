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

// Logging for easy debugging
console.log("Server starting on http://localhost:10101");

Bun.serve({
    port: 10101,

    async fetch(request) {
        const url = new URL(request.url);
        console.log("Incoming request:", url.pathname + url.search);

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