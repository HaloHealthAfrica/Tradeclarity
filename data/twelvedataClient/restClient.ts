import axios from 'axios';

const API_KEY = process.env.TWELVEDATA_API_KEY;
const BASE_URL = 'https://api.twelvedata.com';

export const fetchHistoricalCandles = async (symbol: string, interval: string, count: number = 100) => {
    const url = \`\${BASE_URL}/time_series?symbol=\${symbol}&interval=\${interval}&outputsize=\${count}&apikey=\${API_KEY}\`;
    const response = await axios.get(url);
    return response.data?.values || [];
};
