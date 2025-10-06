"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface FundingRate {
  symbol: string;
  fundingRate: number;
  nextFundingTime: string;
  markPrice: number;
  exchange: string;
}

interface FundingRateResponse {
  success: boolean;
  data: FundingRate[];
  timestamp: number;
}

function StatsCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function FundingRateRow({ rate }: { rate: FundingRate }) {
  const getColor = (rateValue: number) => {
    const absRate = Math.abs(rateValue);
    if (absRate > 0.1) return "text-red-500 dark:text-red-400";
    if (absRate > 0.05) return "text-orange-500 dark:text-orange-400";
    if (rateValue > 0) return "text-green-500 dark:text-green-400";
    return "text-blue-500 dark:text-blue-400";
  };

  const getNextTime = (nextFundingTime: string) => {
    const now = Date.now();
    const nextTime = new Date(nextFundingTime).getTime();
    const diff = nextTime - now;
    
    if (diff < 0) return "即将结算";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours + "小时 " + minutes + "分钟";
  };

  const rateColor = getColor(rate.fundingRate);
  const ratePercent = rate.fundingRate * 100;
  const rate8h = ratePercent * 3;
  const rate8hColor = getColor(rate.fundingRate * 3);
  const nextTime = getNextTime(rate.nextFundingTime);
  const isPositive = rate.fundingRate > 0;

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="px-4 py-3 text-sm font-medium">{rate.symbol}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="text-xs">
          {rate.exchange}
        </Badge>
      </td>
      <td className={cn("px-4 py-3 text-right text-sm font-bold", rateColor)}>
        {ratePercent.toFixed(4)}%
      </td>
      <td className={cn("px-4 py-3 text-right text-sm", rate8hColor)}>
        {rate8h.toFixed(4)}%
      </td>
      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
        {nextTime}
      </td>
      <td className="px-4 py-3 text-center">
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-green-500 mx-auto" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500 mx-auto" />
        )}
      </td>
    </tr>
  );
}

export default function FundingRateMonitor() {
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const fetchData = async () => {
    try {
      setError(null);
      let url = "/api/funding-rates";
      if (selectedExchange !== "all") {
        url = url + "?exchange=" + selectedExchange;
      }
      
      const response = await fetch(url);
      const result: FundingRateResponse = await response.json();

      if (result.success && result.data) {
        setFundingRates(result.data);
        setLastUpdate(Date.now());
      } else {
        setError("获取资金费率失败");
      }
    } catch (err) {
      setError("获取资金费率时出错，请重试");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedExchange]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedExchange]);

  const highAlerts = fundingRates.filter(r => Math.abs(r.fundingRate) > 0.001);
  const avgRate = fundingRates.length === 0 ? "0.0000" : 
    ((fundingRates.reduce((acc, r) => acc + r.fundingRate, 0) / fundingRates.length) * 100).toFixed(4);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="交易对数量" value={fundingRates.length} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              高费率警报
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{highAlerts.length}</div>
          </CardContent>
        </Card>
        <StatsCard title="平均费率" value={avgRate + "%"} />
        <StatsCard title="最后更新" value={new Date(lastUpdate).toLocaleTimeString()} />
      </div>

      {highAlerts.length > 0 && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-500 dark:text-red-400">
            {highAlerts.length} 个交易对处于高资金费率
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>资金费率监控</CardTitle>
              <CardDescription>实时加密货币资金费率</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <Bell className={cn("h-4 w-4 mr-2", autoRefresh && "text-green-500")} />
                {autoRefresh ? "自动" : "手动"}
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
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { key: "all", label: "全部" },
              { key: "binance", label: "Binance" },
              { key: "okx", label: "OKX" },
              { key: "bybit", label: "Bybit" }
            ].map((exchange) => (
              <Button
                key={exchange.key}
                variant={selectedExchange === exchange.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedExchange(exchange.key)}
              >
                {exchange.label}
              </Button>
            ))}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">交易对</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">交易所</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">资金费率</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">8小时费率</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">下次结算</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  {fundingRates.slice(0, 100).map((rate, index) => (
                    <FundingRateRow key={rate.exchange + "-" + rate.symbol + "-" + index} rate={rate} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}