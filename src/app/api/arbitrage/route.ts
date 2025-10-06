import { NextResponse } from 'next/server';

interface ArbitrageOpportunity {
  symbol: string;
  type: 'spot-futures' | 'cross-exchange';
  spotPrice: number;
  futuresPrice: number;
  spreadPercent: number;
  spreadValue: number;
  exchange1: string;
  exchange2?: string;
  direction: 'long-spot-short-futures' | 'short-spot-long-futures' | 'buy-exchange1-sell-exchange2';
  annualizedReturn?: number;
  fundingRate?: number;
  profitability: 'high' | 'medium' | 'low';
}

// 获取Binance现货和合约价格
async function fetchBinancePrices() {
  try {
    const [spotRes, futuresRes] = await Promise.all([
      fetch('https://api.binance.com/api/v3/ticker/price', {
        next: { revalidate: 30 },
        headers: { 'Accept': 'application/json' }
      }),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex', {
        next: { revalidate: 30 },
        headers: { 'Accept': 'application/json' }
      })
    ]);

    if (!spotRes.ok || !futuresRes.ok) {
      console.error('Binance API error:', spotRes.status, futuresRes.status);
      return { exchange: 'Binance', prices: {} };
    }

    const spotData = await spotRes.json();
    const futuresData = await futuresRes.json();

    const priceMap: { [key: string]: { spot: number; futures: number; fundingRate: number } } = {};

    if (Array.isArray(spotData)) {
      spotData.forEach((item: any) => {
        if (item.symbol.endsWith('USDT')) {
          priceMap[item.symbol] = {
            spot: parseFloat(item.price),
            futures: 0,
            fundingRate: 0
          };
        }
      });
    }

    if (Array.isArray(futuresData)) {
      futuresData.forEach((item: any) => {
        if (priceMap[item.symbol]) {
          priceMap[item.symbol].futures = parseFloat(item.markPrice);
          priceMap[item.symbol].fundingRate = parseFloat(item.lastFundingRate);
        }
      });
    }

    console.log('Binance prices fetched:', Object.keys(priceMap).length);
    return { exchange: 'Binance', prices: priceMap };
  } catch (error) {
    console.error('Error fetching Binance prices:', error);
    return { exchange: 'Binance', prices: {} };
  }
}

// 获取OKX现货和合约价格
async function fetchOKXPrices() {
  try {
    const [spotRes, swapRes] = await Promise.all([
      fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
        next: { revalidate: 30 },
        headers: { 'Accept': 'application/json' }
      }),
      fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP', {
        next: { revalidate: 30 },
        headers: { 'Accept': 'application/json' }
      })
    ]);

    if (!spotRes.ok || !swapRes.ok) {
      console.error('OKX API error:', spotRes.status, swapRes.status);
      return { exchange: 'OKX', prices: {} };
    }

    const spotData = await spotRes.json();
    const swapData = await swapRes.json();

    const priceMap: { [key: string]: { spot: number; futures: number; fundingRate: number } } = {};

    if (spotData.code === '0' && spotData.data) {
      spotData.data.forEach((item: any) => {
        if (item.instId.endsWith('-USDT')) {
          const symbol = item.instId.replace('-USDT', 'USDT');
          priceMap[symbol] = {
            spot: parseFloat(item.last),
            futures: 0,
            fundingRate: 0
          };
        }
      });
    }

    if (swapData.code === '0' && swapData.data) {
      swapData.data.forEach((item: any) => {
        if (item.instId.endsWith('-USDT-SWAP')) {
          const symbol = item.instId.replace('-USDT-SWAP', 'USDT');
          if (priceMap[symbol]) {
            priceMap[symbol].futures = parseFloat(item.last);
            priceMap[symbol].fundingRate = parseFloat(item.fundingRate || 0);
          }
        }
      });
    }

    console.log('OKX prices fetched:', Object.keys(priceMap).length);
    return { exchange: 'OKX', prices: priceMap };
  } catch (error) {
    console.error('Error fetching OKX prices:', error);
    return { exchange: 'OKX', prices: {} };
  }
}

// 获取Bybit现货和合约价格
async function fetchBybitPrices() {
  try {
    const [spotRes, futuresRes] = await Promise.all([
      fetch('https://api.bybit.com/v5/market/tickers?category=spot', {
        next: { revalidate: 30 },
        headers: { 'Accept': 'application/json' }
      }),
      fetch('https://api.bybit.com/v5/market/tickers?category=linear', {
        next: { revalidate: 30 },
        headers: { 'Accept': 'application/json' }
      })
    ]);

    if (!spotRes.ok || !futuresRes.ok) {
      console.error('Bybit API error:', spotRes.status, futuresRes.status);
      return { exchange: 'Bybit', prices: {} };
    }

    const spotData = await spotRes.json();
    const futuresData = await futuresRes.json();

    const priceMap: { [key: string]: { spot: number; futures: number; fundingRate: number } } = {};

    if (spotData.retCode === 0 && spotData.result?.list) {
      spotData.result.list.forEach((item: any) => {
        if (item.symbol.endsWith('USDT')) {
          priceMap[item.symbol] = {
            spot: parseFloat(item.lastPrice),
            futures: 0,
            fundingRate: 0
          };
        }
      });
    }

    if (futuresData.retCode === 0 && futuresData.result?.list) {
      futuresData.result.list.forEach((item: any) => {
        if (priceMap[item.symbol]) {
          priceMap[item.symbol].futures = parseFloat(item.markPrice);
          priceMap[item.symbol].fundingRate = parseFloat(item.fundingRate || 0);
        }
      });
    }

    console.log('Bybit prices fetched:', Object.keys(priceMap).length);
    return { exchange: 'Bybit', prices: priceMap };
  } catch (error) {
    console.error('Error fetching Bybit prices:', error);
    return { exchange: 'Bybit', prices: {} };
  }
}

// 计算期现套利机会
function calculateSpotFuturesArbitrage(
  exchange: string,
  prices: { [key: string]: { spot: number; futures: number; fundingRate: number } }
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  Object.entries(prices).forEach(([symbol, data]) => {
    if (data.spot > 0 && data.futures > 0) {
      const spreadValue = data.futures - data.spot;
      const spreadPercent = (spreadValue / data.spot) * 100;

      // 只显示差价超过0.1%的机会
      if (Math.abs(spreadPercent) > 0.1) {
        const direction = spreadPercent > 0 
          ? 'long-spot-short-futures' as const
          : 'short-spot-long-futures' as const;

        // 计算年化收益（假设每8小时收取一次资金费率）
        const annualizedReturn = Math.abs(spreadPercent) + (data.fundingRate * 100 * 365 * 3);

        opportunities.push({
          symbol,
          type: 'spot-futures',
          spotPrice: data.spot,
          futuresPrice: data.futures,
          spreadPercent,
          spreadValue,
          exchange1: exchange,
          direction,
          fundingRate: data.fundingRate,
          annualizedReturn,
          profitability: Math.abs(spreadPercent) > 1 ? 'high' : Math.abs(spreadPercent) > 0.5 ? 'medium' : 'low'
        });
      }
    }
  });

  return opportunities;
}

// 计算跨交易所套利机会
function calculateCrossExchangeArbitrage(
  data1: { exchange: string; prices: any },
  data2: { exchange: string; prices: any }
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  // 找到两个交易所都有的币种
  const commonSymbols = Object.keys(data1.prices).filter(symbol => data2.prices[symbol]);

  commonSymbols.forEach(symbol => {
    const price1Spot = data1.prices[symbol].spot;
    const price2Spot = data2.prices[symbol].spot;

    if (price1Spot > 0 && price2Spot > 0) {
      const spreadValue = price1Spot - price2Spot;
      const spreadPercent = (spreadValue / price2Spot) * 100;

      // 只显示差价超过0.2%的机会（考虑手续费）
      if (Math.abs(spreadPercent) > 0.2) {
        opportunities.push({
          symbol,
          type: 'cross-exchange',
          spotPrice: spreadPercent > 0 ? price2Spot : price1Spot,
          futuresPrice: spreadPercent > 0 ? price1Spot : price2Spot,
          spreadPercent: Math.abs(spreadPercent),
          spreadValue: Math.abs(spreadValue),
          exchange1: spreadPercent > 0 ? data2.exchange : data1.exchange,
          exchange2: spreadPercent > 0 ? data1.exchange : data2.exchange,
          direction: 'buy-exchange1-sell-exchange2',
          profitability: Math.abs(spreadPercent) > 0.8 ? 'high' : Math.abs(spreadPercent) > 0.4 ? 'medium' : 'low'
        });
      }
    }
  });

  return opportunities;
}

export async function GET() {
  try {
    // 并行获取所有交易所数据
    const [binanceData, okxData, bybitData] = await Promise.all([
      fetchBinancePrices(),
      fetchOKXPrices(),
      fetchBybitPrices()
    ]);

    // 计算期现套利机会
    const spotFuturesArbitrage = [
      ...calculateSpotFuturesArbitrage(binanceData.exchange, binanceData.prices),
      ...calculateSpotFuturesArbitrage(okxData.exchange, okxData.prices),
      ...calculateSpotFuturesArbitrage(bybitData.exchange, bybitData.prices)
    ];

    console.log('Spot-futures arbitrage opportunities:', spotFuturesArbitrage.length);

    // 计算跨交易所套利机会
    const crossExchangeArbitrage = [
      ...calculateCrossExchangeArbitrage(binanceData, okxData),
      ...calculateCrossExchangeArbitrage(binanceData, bybitData),
      ...calculateCrossExchangeArbitrage(okxData, bybitData)
    ];

    console.log('Cross-exchange arbitrage opportunities:', crossExchangeArbitrage.length);

    // 合并并按差价百分比排序
    const allOpportunities = [...spotFuturesArbitrage, ...crossExchangeArbitrage]
      .sort((a, b) => Math.abs(b.spreadPercent) - Math.abs(a.spreadPercent))
      .slice(0, 100); // 只返回前100个机会

    return NextResponse.json({
      opportunities: allOpportunities,
      timestamp: Date.now(),
      summary: {
        total: allOpportunities.length,
        spotFutures: spotFuturesArbitrage.length,
        crossExchange: crossExchangeArbitrage.length,
        highProfitability: allOpportunities.filter(o => o.profitability === 'high').length
      }
    });
  } catch (error) {
    console.error('Error in arbitrage API:', error);
    return NextResponse.json(
      { error: '获取套利机会失败' },
      { status: 500 }
    );
  }
}