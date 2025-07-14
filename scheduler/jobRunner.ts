import { initializeSymbol } from '../data/twelvedataClient/dataManager';

export const scheduleJobs = async () => {
    await initializeSymbol('AAPL', '1min');
    await initializeSymbol('MSFT', '1min');
};
