# 币圈资金费监控系统 - 部署指南

## 功能特性

- ✅ 实时监控 Binance、OKX、Bybit 三大交易所的资金费率
- ✅ 自动刷新数据（每30秒）
- ✅ 高资金费率告警（>0.1%）
- ✅ 深色主题界面
- ✅ 响应式设计
- ✅ Docker 一键部署

## 快速部署到VPS

### 方法一：使用 Docker Compose（推荐）

1. **克隆或上传项目到VPS**
```bash
# 克隆项目（如果使用Git）
git clone <your-repo-url>
cd <project-directory>

# 或者使用 scp 上传项目文件
```

2. **构建并启动服务**
```bash
docker-compose up -d --build
```

3. **查看运行状态**
```bash
docker-compose ps
docker-compose logs -f
```

4. **访问应用**
```
http://your-vps-ip:3000
```

5. **停止服务**
```bash
docker-compose down
```

### 方法二：使用 Docker 直接部署

1. **构建镜像**
```bash
docker build -t funding-rate-monitor .
```

2. **运行容器**
```bash
docker run -d \
  --name funding-rate-monitor \
  --restart unless-stopped \
  -p 3000:3000 \
  funding-rate-monitor
```

3. **查看日志**
```bash
docker logs -f funding-rate-monitor
```

### 方法三：Node.js 直接部署

1. **安装依赖**
```bash
npm install
```

2. **构建项目**
```bash
npm run build
```

3. **启动服务**
```bash
npm start
```

4. **使用 PM2 保持运行（推荐）**
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start npm --name "funding-monitor" -- start

# 设置开机自启
pm2 startup
pm2 save
```

## 配置 Nginx 反向代理（可选）

如果想使用域名访问，可以配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 更新应用

### Docker Compose 方式
```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

### Docker 方式
```bash
docker stop funding-rate-monitor
docker rm funding-rate-monitor
docker build -t funding-rate-monitor .
docker run -d --name funding-rate-monitor --restart unless-stopped -p 3000:3000 funding-rate-monitor
```

## 监控和维护

### 查看运行状态
```bash
docker-compose ps
# 或
docker ps | grep funding-rate-monitor
```

### 查看资源占用
```bash
docker stats funding-rate-monitor
```

### 备份和恢复
```bash
# 导出镜像
docker save -o funding-rate-monitor.tar funding-rate-monitor

# 导入镜像
docker load -i funding-rate-monitor.tar
```

## 故障排查

### 容器无法启动
```bash
docker-compose logs
```

### 端口被占用
```bash
# 修改 docker-compose.yml 中的端口映射
ports:
  - "8080:3000"  # 改为其他端口
```

### 内存不足
```bash
# 在 docker-compose.yml 中添加内存限制
services:
  funding-rate-monitor:
    deploy:
      resources:
        limits:
          memory: 512M
```

## 系统要求

- **最低配置**：1核 CPU，512MB RAM
- **推荐配置**：2核 CPU，1GB RAM
- **磁盘空间**：至少 2GB
- **Docker 版本**：20.10+
- **Docker Compose 版本**：2.0+

## 防火墙设置

确保开放 3000 端口（或你自定义的端口）：

```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## 技术栈

- Next.js 15
- TypeScript
- Tailwind CSS
- Shadcn/UI
- Docker

## API 端点

- `GET /api/funding-rates` - 获取所有交易所的资金费率
- `GET /api/funding-rates?exchange=binance` - 获取指定交易所的资金费率

## 许可证

MIT