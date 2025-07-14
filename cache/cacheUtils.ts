export const shouldUpdate = (lastTimestamp: string, currentTimestamp: string): boolean => {
    return new Date(currentTimestamp) > new Date(lastTimestamp);
};
