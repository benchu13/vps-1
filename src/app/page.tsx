import FundingRateMonitor from "@/components/FundingRateMonitor";
import ArbitrageMonitor from "@/components/ArbitrageMonitor";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">本初资金费监控</h1>
          <p className="text-muted-foreground">实时监控 Binance、OKX、Bybit 资金费率</p>
        </div>
        <FundingRateMonitor />
        
        <div className="mt-12 mb-8">
          <h2 className="text-3xl font-bold mb-2">套利机会监控</h2>
          <p className="text-muted-foreground">实时监控现货合约差价和跨交易所套利机会</p>
        </div>
        <ArbitrageMonitor />
      </div>
    </div>
  );
}