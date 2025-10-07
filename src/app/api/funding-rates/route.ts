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
    console.log('[Binance] Fetching funding rates...');
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    };
    
    // 如果有 API key，添加认证
    if (process.env.BINANCE_API_KEY) {
      headers['X-MBX-APIKEY'] = process.env.BINANCE_API_KEY;
    }
    
    const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex', {
      headers,
      signal: AbortSignal.timeout(10000) // 10 秒超时
    });
    
    console.log('[Binance] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Binance] API error:', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    console.log('[Binance] Data received, length:', Array.isArray(data) ? data.length : 'not array');
    
    if (!Array.isArray(data)) {
      console.error('[Binance] API returned non-array data:', typeof data);
      return [];
    }
    
    const rates = data.slice(0, 100).map((item: any) => ({
      symbol: item.symbol,
      fundingRate: parseFloat(item.lastFundingRate),
      nextFundingTime: new Date(item.nextFundingTime).toISOString(),
      markPrice: parseFloat(item.markPrice) || 0,
      exchange: 'Binance'
    }));
    
    console.log('[Binance] Successfully parsed:', rates.length, 'rates');
    return rates;
  } catch (error) {
    console.error('[Binance] Error fetching funding rates:', error);
    return [];
  }
}

// Fetch funding rates from OKX
async function fetchOKXFundingRates(): Promise<FundingRate[]> {
  try {
    console.log('[OKX] Fetching funding rates...');
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    };
    
    // 如果有 API key，添加认证（OKX 需要签名，这里简化处理）
    if (process.env.OKX_API_KEY) {
      headers['OK-ACCESS-KEY'] = process.env.OKX_API_KEY;
    }
    
    const response = await fetch('https://www.okx.com/api/v5/public/funding-rate?instType=SWAP', {
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('[OKX] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OKX] API error:', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    console.log('[OKX] Data received:', data.code, 'data length:', data.data?.length);
    
    if (data.code === '0' && data.data) {
      const rates = data.data.slice(0, 100).map((item: any) => ({
        symbol: item.instId.replace('-SWAP', ''),
        fundingRate: parseFloat(item.fundingRate),
        nextFundingTime: new Date(parseInt(item.nextFundingTime)).toISOString(),
        markPrice: 0,
        exchange: 'OKX'
      }));
      
      console.log('[OKX] Successfully parsed:', rates.length, 'rates');
      return rates;
    }
    
    console.error('[OKX] Unexpected response format');
    return [];
  } catch (error) {
    console.error('[OKX] Error fetching funding rates:', error);
    return [];
  }
}

// Fetch funding rates from Bybit
async function fetchBybitFundingRates(): Promise<FundingRate[]> {
  try {
    console.log('[Bybit] Fetching funding rates...');
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    };
    
    // 如果有 API key，添加认证
    if (process.env.BYBIT_API_KEY) {
      headers['X-BAPI-API-KEY'] = process.env.BYBIT_API_KEY;
    }
    
    const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', {
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('[Bybit] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Bybit] API error:', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    console.log('[Bybit] Data received, retCode:', data.retCode, 'list length:', data.result?.list?.length);
    
    if (data.retCode === 0 && data.result?.list) {
      const rates = data.result.list.slice(0, 100)
        .filter((item: any) => item.fundingRate)
        .map((item: any) => ({
          symbol: item.symbol,
          fundingRate: parseFloat(item.fundingRate),
          nextFundingTime: new Date(parseInt(item.nextFundingTime) || Date.now() + 8 * 3600 * 1000).toISOString(),
          markPrice: parseFloat(item.markPrice) || 0,
          exchange: 'Bybit'
        }));
      
      console.log('[Bybit] Successfully parsed:', rates.length, 'rates');
      return rates;
    }
    
    console.error('[Bybit] Unexpected response format');
    return [];
  } catch (error) {
    console.error('[Bybit] Error fetching funding rates:', error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    console.log('=== Funding Rates API Called ===');
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange');

    let fundingRates: FundingRate[] = [];

    if (exchange === 'binance' || !exchange) {
      const binanceRates = await fetchBinanceFundingRates();
      fundingRates = [...fundingRates, ...binanceRates];
    }

    if (exchange === 'okx' || !exchange) {
      const okxRates = await fetchOKXFundingRates();
      fundingRates = [...fundingRates, ...okxRates];
    }

    if (exchange === 'bybit' || !exchange) {
      const bybitRates = await fetchBybitFundingRates();
      fundingRates = [...fundingRates, ...bybitRates];
    }

    fundingRates.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

    console.log('=== Total rates fetched:', fundingRates.length, '===');

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