"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeError = exports.DataError = exports.TradingSystemError = void 0;
// Error types
class TradingSystemError extends Error {
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'TradingSystemError';
    }
}
exports.TradingSystemError = TradingSystemError;
class DataError extends TradingSystemError {
    constructor(message, context) {
        super(message, 'DATA_ERROR', context);
        this.name = 'DataError';
    }
}
exports.DataError = DataError;
class TradeError extends TradingSystemError {
    constructor(message, context) {
        super(message, 'TRADE_ERROR', context);
        this.name = 'TradeError';
    }
}
exports.TradeError = TradeError;
