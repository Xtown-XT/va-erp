import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Button, Spin, Typography, message, Space, Tag, Avatar, List } from 'antd';
import {
  DollarCircleOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
  FireOutlined,
  TeamOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import dayjs from 'dayjs';
import api from '../service/api';
import { useSites } from '../hooks/useQueries';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Shadcn-style Card Component
const DashboardCard = ({ title, value, icon, subtext, trend, className }) => (
  <div className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all ${className}`}>
    <div className="flex justify-between items-start mb-2">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      {icon && <div className="text-gray-400">{icon}</div>}
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
  </div>
);

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [dates, setDates] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [selectedSite, setSelectedSite] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [dates, selectedSite]);

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
    return (val || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  };

  const formatNumber = (val) => {
    return (val || 0).toLocaleString('en-IN');
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>Dashboard</Title>
          <Text type="secondary">Overview of production and expenses</Text>
        </div>
        <Space wrap>
          <RangePicker
            value={dates}
            onChange={setDates}
            allowClear={false}
            className="w-full md:w-auto"
          />
          <Button icon={<ReloadOutlined />} onClick={fetchStats} />
        </Space>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : stats ? (
        <>
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardCard
              title="Total Production"
              value={`${formatNumber(stats.metrics?.productionMeter)} m`}
              icon={<ThunderboltOutlined className="text-blue-500" />}
              subtext={`${stats.metrics?.holesDrilled} holes drilled`}
            />
            <DashboardCard
              title="Metric Expenses"
              value={formatCurrency(stats.metrics?.poCreated)}
              icon={<DollarCircleOutlined className="text-green-500" />}
              subtext={`Received: ${formatCurrency(stats.metrics?.poReceived)}`}
            />
            <DashboardCard
              title="Diesel Consumed"
              value={`${formatNumber(stats.metrics?.dieselConsumed)} L`}
              icon={<FireOutlined className="text-orange-500" />}
              subtext="Machine + Compressor"
            />
            <DashboardCard
              title="Active Sites"
              value={stats.counts?.sites}
              icon={<AppstoreOutlined className="text-purple-500" />}
              subtext={`${stats.counts?.employees} Active Employees`}
            />
          </div>

          {/* Charts & Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">

            {/* Main Chart (Overview) - Takes 4 cols */}
            <div className="lg:col-span-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <Title level={5}>Production Overview</Title>
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.overview || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => dayjs(val).format('DD MMM')}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(label) => dayjs(label).format('DD MMM YYYY')}
                      formatter={(value) => [`${value} m`, 'Production']}
                      cursor={{ fill: '#f3f4f6' }}
                    />
                    <Bar dataKey="totalMeter" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Activity - Takes 3 cols */}
            <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
              <Title level={5} className="mb-4">Recent Daily Entries</Title>
              <div className="flex-1 overflow-auto pr-2">
                <List
                  itemLayout="horizontal"
                  dataSource={stats.recentActivity || []}
                  renderItem={(item) => (
                    <List.Item className="!px-0 !border-b-gray-100 hover:bg-gray-50 rounded-lg p-2 transition-colors cursor-default">
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{ backgroundColor: '#e6f7ff', color: '#1890ff' }}
                            icon={<ThunderboltOutlined />}
                          />
                        }
                        title={
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-800">{item.site?.siteName}</span>
                            <span className="text-xs text-gray-500">{dayjs(item.date).format('DD MMM')}</span>
                          </div>
                        }
                        description={
                          <div className="flex justify-between items-center mt-1">
                            <Tag className="m-0" color="blue">{item.machine?.machineNumber}</Tag>
                            <span className="text-sm font-semibold text-gray-700">{item.meter} m</span>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center">
              <div className="text-indigo-600 font-bold text-2xl">{stats.counts?.employees}</div>
              <div className="text-indigo-400 text-xs font-medium uppercase tracking-wider">Employees</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
              <div className="text-amber-600 font-bold text-2xl">{stats.counts?.machines}</div>
              <div className="text-amber-400 text-xs font-medium uppercase tracking-wider">Machines</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
              <div className="text-emerald-600 font-bold text-2xl">{formatCurrency(stats.counts?.employeeAdvance)}</div>
              <div className="text-emerald-400 text-xs font-medium uppercase tracking-wider">Total Advance</div>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-center">
              <div className="text-rose-600 font-bold text-2xl">{formatCurrency(stats.metrics?.salariesPaid)}</div>
              <div className="text-rose-400 text-xs font-medium uppercase tracking-wider">Salaries Paid</div>
            </div>
          </div>

        </>
      ) : null}
    </div>
  );
};

export default Dashboard;