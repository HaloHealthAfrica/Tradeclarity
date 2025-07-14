export const evaluateSignal = (signal: any): boolean => {
    return signal?.confidence >= 0.7;
};
