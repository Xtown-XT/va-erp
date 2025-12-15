import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Select, Spin, Typography, message, Space, Button } from 'antd';
import {
  DollarCircleOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
  FireOutlined,
  TeamOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
  CarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../service/api';
import { useSites } from '../hooks/useQueries';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [dates, setDates] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [selectedSite, setSelectedSite] = useState(null);

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState(null);

  // Use Query Hook
  const { data: sites = [] } = useSites();

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  useEffect(() => {
    fetchStats();
  }, [dates, selectedSite]);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the A2HS prompt');
      }
      setInstallPrompt(null);
    });
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [start, end] = dates || [];
      const params = {
        startDate: start ? start.format('YYYY-MM-DD') : undefined,
        endDate: end ? end.format('YYYY-MM-DD') : undefined,
        siteId: selectedSite
      };
      const res = await api.get('/api/dashboard/stats', { params });
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error("Dashboard error:", error);
      message.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    // Compact currency format for mobile (e.g. 1.2k, 1.5L) could be good, but standard locale string is safer for accuracy requested.
    return val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  };

  // Ultra-Compact Stat Item
  const CountItem = ({ title, value, color }) => (
    <div className="bg-white rounded border p-2 flex flex-col items-center justify-center text-center shadow-sm h-full">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{title}</div>
      <div className="text-xl font-bold mt-1" style={{ color: color }}>{value}</div>
    </div>
  );

  const MetricItem = ({ title, value, sub, color }) => (
    <div className="flex justify-between items-center p-3 bg-white rounded border shadow-sm">
      <div>
        <div className="text-xs text-gray-500 uppercase font-semibold">{title}</div>
        <div className="text-lg font-bold text-gray-800">{value}</div>
      </div>
      {sub && <div className="text-xs font-medium px-2 py-1 rounded bg-gray-50 text-gray-600">{sub}</div>}
    </div>
  );

  return (
    <div className="p-2 sm:p-4 bg-gray-50 min-h-screen">
      {/* 1. Header & Install */}
      <div className="flex justify-between items-center mb-4">
        <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
        {installPrompt && (
          <Button type="primary" size="small" onClick={handleInstallClick} icon={<DollarCircleOutlined />}>
            Install App
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        {stats && (
          <div className="flex flex-col gap-4">

            {/* 2. Top Calls: Counts (Grid of 3x2 on mobile, 6x1 on PC) */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4">
              <CountItem title="Employees" value={stats.counts?.employees} color="#1890ff" />
              <CountItem title="Machines" value={stats.counts?.machines} color="#faad14" />
              <CountItem title="Sites" value={stats.counts?.sites} color="#52c41a" />
              <CountItem title="Compressors" value={stats.counts?.compressors} color="#eb2f96" />
              <CountItem title="Suppliers" value={stats.counts?.suppliers} color="#722ed1" />
              {/* Employee Advance is a sum, but placed here as requested */}
              <div className="bg-white rounded border p-2 flex flex-col items-center justify-center text-center shadow-sm h-full border-red-100 bg-red-50">
                <div className="text-[10px] text-red-500 uppercase font-bold">Total Advance</div>
                <div className="text-sm font-bold text-red-700">{formatCurrency(stats.counts?.employeeAdvance)}</div>
              </div>
            </div>

            {/* 3. Date Filter */}
            <div className="bg-white p-2 rounded border shadow-sm w-full md:w-auto md:max-w-md">
              <div className="text-xs text-gray-400 mb-1 font-semibold uppercase">Filter Range</div>
              <RangePicker
                value={dates}
                onChange={setDates}
                allowClear={false}
                className="w-full"
                size="small"
              />
            </div>

            {/* 4. Filtered Metrics List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
              <MetricItem
                title="PO Created Used"
                value={formatCurrency(stats.metrics?.poCreated)}
                color="blue"
                sub="Expense"
              />
              <MetricItem
                title="PO Received Value"
                value={formatCurrency(stats.metrics?.poReceived)}
                color="green"
                sub="Goods"
              />
              <MetricItem
                title="Salaries Paid"
                value={formatCurrency(stats.metrics?.salariesPaid)}
                color="indigo"
                sub="Paid"
              />
              <MetricItem
                title="Total Meters"
                value={`${stats.metrics?.productionMeter} m`}
                color="cyan"
              />
              <MetricItem
                title="Holes Drilled"
                value={stats.metrics?.holesDrilled}
                color="purple"
              />
              <MetricItem
                title="Diesel Consumed"
                value={`${stats.metrics?.dieselConsumed} L`}
                color="orange"
              />
            </div>

          </div>
        )}
      </Spin>
    </div>
  );
};

export default Dashboard;