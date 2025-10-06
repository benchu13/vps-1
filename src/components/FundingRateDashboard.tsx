"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FundingRate {
  symbol: string;
  exchange: string;
  fundingRate: number;
  nextFundingTime: string;
  markPrice: number;
}

export default function FundingRateDashboard() {
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [alertThreshold, setAlertThreshold] = useState(0.1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchFundingRates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/funding-rates");
      const data = await response.json();
      setFundingRates(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching funding rates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFundingRates();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchFundingRates();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getFundingRateColor = (rate: number) => {
    const absRate = Math.abs(rate);
    if (absRate > alertThreshold) return "text-red-500";
    if (absRate > alertThreshold / 2) return "text-yellow-500";
    return "text-green-500";
  };

  const getFundingRateBadge = (rate: number) => {
    const absRate = Math.abs(rate);
    if (absRate > alertThreshold) return "destructive";
    if (absRate > alertThreshold / 2) return "default";
    return "secondary";
  };

  const formatFundingRate = (rate: number) => {
    return `${(rate * 100).toFixed(4)}%`;
  };

  const formatNextFundingTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const sortedRates = [...fundingRates].sort((a, b) => 
    Math.abs(b.fundingRate) - Math.abs(a.fundingRate)
  );

  const highAlerts = fundingRates.filter(
    rate => Math.abs(rate.fundingRate) > alertThreshold
  );

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>控制面板</CardTitle>
          <CardDescription>配置监控和告警设置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={fetchFundingRates} 
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "刷新中..." : "手动刷新"}
            </Button>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              size="sm"
            >
              {autoRefresh ? "自动刷新：开启" : "自动刷新：关闭"}
            </Button>
            {lastUpdate && (
              <span className="text-sm text-muted-foreground">
                最后更新：{lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="threshold">告警阈值 (%)</Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              当资金费率超过 {alertThreshold}% 时会高亮显示
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {highAlerts.length > 0 && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              高资金费率警报
            </CardTitle>
            <CardDescription>
              以下交易对的资金费率超过了 {alertThreshold}% 阈值
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {highAlerts.map((rate, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{rate.exchange}</Badge>
                    <span className="font-semibold">{rate.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-red-500 font-bold">
                      {formatFundingRate(rate.fundingRate)}
                    </span>
                    {rate.fundingRate > 0 ? (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funding Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>资金费率监控</CardTitle>
          <CardDescription>
            实时显示 Binance、OKX、Bybit 的资金费率 (共 {fundingRates.length} 个交易对)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && fundingRates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">交易所</th>
                    <th className="text-left py-3 px-4">交易对</th>
                    <th className="text-right py-3 px-4">资金费率</th>
                    <th className="text-right py-3 px-4">标记价格</th>
                    <th className="text-right py-3 px-4">下次结算</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRates.map((rate, index) => (
                    <tr 
                      key={index}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Badge variant="outline">{rate.exchange}</Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        {rate.symbol}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={getFundingRateBadge(rate.fundingRate)}>
                            <span className={`font-mono ${getFundingRateColor(rate.fundingRate)}`}>
                              {formatFundingRate(rate.fundingRate)}
                            </span>
                          </Badge>
                          {rate.fundingRate > 0 ? (
                            <TrendingUp className={`h-4 w-4 ${getFundingRateColor(rate.fundingRate)}`} />
                          ) : (
                            <TrendingDown className={`h-4 w-4 ${getFundingRateColor(rate.fundingRate)}`} />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        ${rate.markPrice.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {formatNextFundingTime(rate.nextFundingTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}