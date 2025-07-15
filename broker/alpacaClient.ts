import axios from 'axios';

const API_KEY = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;
const BASE_URL = 'https://paper-api.alpaca.markets';

export const placeOrder = async (symbol: string, qty: number, side: 'buy' | 'sell') => {
    const response = await axios.post(`${BASE_URL}/v2/orders`, {
        symbol,
        qty,
        side,
        type: "market",
        time_in_force: "gtc"
    }, {
        headers: {
            'APCA-API-KEY-ID': API_KEY,
            'APCA-API-SECRET-KEY': API_SECRET
        }
    });

    return response.data;
};
