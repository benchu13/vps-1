import { NextResponse } from 'next/server';

interface FundingRate {
  symbol: string;
  fundingRate: number;
  nextFundingTime: string;
  markPrice: number;
  exchange: string;
}

// Fetch funding rates from Binance
async function fetchBinanceFundingRates(): Promise<FundingRate[]> {
  try {
    const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex', {
      next: { revalidate: 30 },
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('Binance API error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error('Binance API returned non-array data');
      return [];
    }
    
    return data.slice(0, 100).map((item: any) => ({
      symbol: item.symbol,
      fundingRate: parseFloat(item.lastFundingRate),
      nextFundingTime: new Date(item.nextFundingTime).toISOString(),
      markPrice: parseFloat(item.markPrice) || 0,
      exchange: 'Binance'
    }));
  } catch (error) {
    console.error('Error fetching Binance funding rates:', error);
    return [];
  }
}

// Fetch funding rates from OKX
async function fetchOKXFundingRates(): Promise<FundingRate[]> {
  try {
    const response = await fetch('https://www.okx.com/api/v5/public/funding-rate?instType=SWAP', {
      next: { revalidate: 30 },
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('OKX API error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    if (data.code === '0' && data.data) {
      return data.data.slice(0, 100).map((item: any) => ({
        symbol: item.instId.replace('-SWAP', ''),
        fundingRate: parseFloat(item.fundingRate),
        nextFundingTime: new Date(parseInt(item.nextFundingTime)).toISOString(),
        markPrice: 0,
        exchange: 'OKX'
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching OKX funding rates:', error);
    return [];
  }
}

// Fetch funding rates from Bybit
async function fetchBybitFundingRates(): Promise<FundingRate[]> {
  try {
    const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', {
      next: { revalidate: 30 },
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('Bybit API error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    if (data.retCode === 0 && data.result?.list) {
      return data.result.list.slice(0, 100)
        .filter((item: any) => item.fundingRate)
        .map((item: any) => ({
          symbol: item.symbol,
          fundingRate: parseFloat(item.fundingRate),
          nextFundingTime: new Date(parseInt(item.nextFundingTime) || Date.now() + 8 * 3600 * 1000).toISOString(),
          markPrice: parseFloat(item.markPrice) || 0,
          exchange: 'Bybit'
        }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching Bybit funding rates:', error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange');

    let fundingRates: FundingRate[] = [];

    if (exchange === 'binance' || !exchange) {
      const binanceRates = await fetchBinanceFundingRates();
      console.log('Binance rates fetched:', binanceRates.length);
      fundingRates = [...fundingRates, ...binanceRates];
    }

    if (exchange === 'okx' || !exchange) {
      const okxRates = await fetchOKXFundingRates();
      console.log('OKX rates fetched:', okxRates.length);
      fundingRates = [...fundingRates, ...okxRates];
    }

    if (exchange === 'bybit' || !exchange) {
      const bybitRates = await fetchBybitFundingRates();
      console.log('Bybit rates fetched:', bybitRates.length);
      fundingRates = [...fundingRates, ...bybitRates];
    }

    fundingRates.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

    return NextResponse.json({
      success: true,
      data: fundingRates,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error in funding rates API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch funding rates', data: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}