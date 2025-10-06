"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, DollarSign, ArrowRightLeft, AlertCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ArbitrageResponse {
  opportunities: ArbitrageOpportunity[];
  timestamp: number;
  summary: {
    total: number;
    spotFutures: number;
    crossExchange: number;
    highProfitability: number;
  };
}

function StatsCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ArbitrageRow({ opp }: { opp: ArbitrageOpportunity }) {
  const getProfitabilityColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return '';
    }
  };

  const getProfitabilityLabel = (level: string) => {
    switch (level) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '';
    }
  };

  const getOperationText = () => {
    if (opp.type === 'spot-futures') {
      if (opp.direction === 'long-spot-short-futures') {
        return `买入${opp.exchange1}现货，做空${opp.exchange1}合约`;
      } else {
        return `做多${opp.exchange1}合约，做空${opp.exchange1}现货`;
      }
    } else {
      return `在${opp.exchange1}买入，在${opp.exchange2}卖出`;
    }
  };

  const getTypeLabel = () => {
    return opp.type === 'spot-futures' ? '期现套利' : '跨所套利';
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="px-4 py-3">
        <div className="font-medium">{opp.symbol}</div>
        <div className="text-xs text-muted-foreground mt-1">{getTypeLabel()}</div>
      </td>
      <td className="px-4 py-3">
        {opp.type === 'spot-futures' ? (
          <Badge variant="outline" className="text-xs">{opp.exchange1}</Badge>
        ) : (
          <div className="flex gap-1 flex-wrap">
            <Badge variant="outline" className="text-xs">{opp.exchange1}</Badge>
            <span className="text-xs">→</span>
            <Badge variant="outline" className="text-xs">{opp.exchange2}</Badge>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="font-mono text-sm">${opp.spotPrice.toFixed(2)}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="font-mono text-sm">${opp.futuresPrice.toFixed(2)}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className={cn("font-bold text-sm", 
          opp.spreadPercent > 0.5 ? "text-red-500" : "text-green-500"
        )}>
          {opp.spreadPercent.toFixed(3)}%
        </div>
        <div className="text-xs text-muted-foreground">
          ${Math.abs(opp.spreadValue).toFixed(2)}
        </div>
      </td>
      {opp.type === 'spot-futures' && (
        <td className="px-4 py-3 text-right">
          <div className="text-sm font-medium">
            {opp.annualizedReturn?.toFixed(2)}%
          </div>
          <div className="text-xs text-muted-foreground">
            资金费: {((opp.fundingRate || 0) * 100).toFixed(4)}%
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        <Badge className={cn("text-xs", getProfitabilityColor(opp.profitability))}>
          {getProfitabilityLabel(opp.profitability)}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
        {getOperationText()}
      </td>
    </tr>
  );
}

export default function ArbitrageMonitor() {
  const [data, setData] = useState<ArbitrageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'spot-futures' | 'cross-exchange'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const fetchData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/arbitrage');
      const result = await response.json();

      if (result.opportunities) {
        setData(result);
        setLastUpdate(Date.now());
      } else {
        setError(result.error || '获取套利机会失败');
      }
    } catch (err) {
      setError('获取套利机会时出错，请重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000); // 30秒刷新
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredOpportunities = data?.opportunities.filter(opp => {
    if (filterType === 'all') return true;
    return opp.type === filterType;
  }) || [];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard 
          title="套利机会总数" 
          value={data?.summary.total || 0} 
          icon={TrendingUp}
        />
        <StatsCard 
          title="期现套利" 
          value={data?.summary.spotFutures || 0}
          icon={ArrowRightLeft}
        />
        <StatsCard 
          title="跨所套利" 
          value={data?.summary.crossExchange || 0}
          icon={DollarSign}
        />
        <StatsCard 
          title="高收益机会" 
          value={data?.summary.highProfitability || 0}
          icon={AlertCircle}
        />
      </div>

      {/* 套利说明 */}
      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Lightbulb className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-500 dark:text-blue-400">
          <div className="space-y-2">
            <div><strong>期现套利：</strong>同时买入现货做空合约（或反向），锁定价差收益。适合低风险套利。</div>
            <div><strong>跨所套利：</strong>在价格低的交易所买入，在价格高的交易所卖出。注意转账时间和手续费。</div>
            <div><strong>风险提示：</strong>套利需要考虑手续费（约0.1-0.2%）、滑点、转账费用和时间成本。建议差价超过0.5%再操作。</div>
          </div>
        </AlertDescription>
      </Alert>

      {/* 主表格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>套利机会监控</CardTitle>
              <CardDescription>
                实时监控现货合约差价和跨交易所套利机会 · 最后更新: {new Date(lastUpdate).toLocaleTimeString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? "自动刷新" : "手动刷新"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选按钮 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              全部 ({data?.summary.total || 0})
            </Button>
            <Button
              variant={filterType === 'spot-futures' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('spot-futures')}
            >
              期现套利 ({data?.summary.spotFutures || 0})
            </Button>
            <Button
              variant={filterType === 'cross-exchange' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('cross-exchange')}
            >
              跨所套利 ({data?.summary.crossExchange || 0})
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 套利机会表格 */}
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">交易对</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">交易所</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">价格1</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">价格2</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">差价百分比</th>
                    {filterType !== 'cross-exchange' && (
                      <th className="px-4 py-3 text-right text-sm font-medium">年化收益</th>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-medium">收益率</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">套利操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        暂无套利机会
                      </td>
                    </tr>
                  ) : (
                    filteredOpportunities.slice(0, 50).map((opp, index) => (
                      <ArbitrageRow key={`${opp.symbol}-${opp.exchange1}-${opp.type}-${index}`} opp={opp} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}