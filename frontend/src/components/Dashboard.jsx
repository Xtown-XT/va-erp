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

  // Custom Compact Card Component
  // Mimics a clean, "shadcn-like" aesthetic with a circular icon and compact text.
  const StatCard = ({ title, value, prefix, suffix, color, icon, secondaryText }) => (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb', // subtle border
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      height: '100%',
      minHeight: '100px'
    }}>
      {/* Icon Circle */}
      <div style={{
        flexShrink: 0,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: color ? `${color}15` : '#f3f4f6', // 10% opacity of color or gray
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color || '#6b7280',
        fontSize: '20px'
      }}>
        {icon || prefix}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: '13px',
          color: '#6b7280',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {title}
        </div>

        <div style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#111827',
          lineHeight: '1.2',
          display: 'flex',
          alignItems: 'baseline',
          gap: '4px'
        }}>
          {/* We handle prefix manually in the icon circle primarily, but if passed explicitly as text: */}
          {!icon && prefix}
          <span title={value}>{value}</span>
          {suffix && <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>{suffix}</span>}
        </div>

        {secondaryText && (
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            {secondaryText}
          </div>
        )}
      </div>
    </div>
  );

  // Helper for large numbers
  const formatCurrency = (val) => {
    if (!val) return 0;
    return val.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>Dashboard</Title>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {installPrompt && (
            <Button type="primary" onClick={handleInstallClick} icon={<DollarCircleOutlined />}>
              Install App
            </Button>
          )}

          <Select
            placeholder="All Sites"
            allowClear
            className="w-full sm:w-48"
            onChange={setSelectedSite}
            value={selectedSite}
          >
            {sites.map(site => (
              <Select.Option key={site.id} value={site.id}>{site.siteName}</Select.Option>
            ))}
          </Select>
          <RangePicker
            value={dates}
            onChange={setDates}
            allowClear={false}
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <Spin spinning={loading}>
        {stats && (
          <div className="flex flex-col gap-6">

            {/* Operations Overview Row */}
            <div>
              <Title level={4}><ShoppingOutlined /> Operations Overview</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <StatCard
                    title="Active Sites"
                    value={stats.operations?.totalSites || 0}
                    icon={<EnvironmentOutlined />}
                    color="#1890ff"
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <StatCard
                    title="Active Machines"
                    value={stats.operations?.totalMachines || 0}
                    icon={<CarOutlined />}
                    color="#faad14"
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <StatCard
                    title="Total Workforce"
                    value={stats.labor?.totalWorkers || 0}
                    icon={<TeamOutlined />}
                    color="#52c41a"
                    secondaryText="Active employees"
                  />
                </Col>
              </Row>
            </div>

            {/* Financials Row */}
            <div>
              <Title level={4}><DollarCircleOutlined /> Financials</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="PO Value Created"
                    value={formatCurrency(stats.po.totalValue)}
                    icon={<DollarCircleOutlined />}
                    color="#cf1322"
                    secondaryText="Total Expenses Raised"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="PO Value Received"
                    value={formatCurrency(stats.po.receivedValue)}
                    icon={<DollarCircleOutlined />}
                    color="#3f8600"
                    secondaryText="Goods Received"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="Salaries Paid"
                    value={formatCurrency(stats.labor?.totalSalaryPaid || 0)}
                    icon={<TeamOutlined />}
                    color="#096dd9"
                    secondaryText="From Attendance"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="Pending Advances"
                    value={formatCurrency(stats.labor?.totalPendingAdvance || 0)}
                    icon={<DollarCircleOutlined />}
                    color="#d48806"
                    secondaryText="Outstanding Amount"
                  />
                </Col>
              </Row>
            </div>

            {/* Production Row */}
            <div>
              <Title level={4}><ThunderboltOutlined /> Production</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="Meters Drilled"
                    value={stats.production.totalMeter}
                    suffix="m"
                    icon={<ThunderboltOutlined />}
                    color="#1890ff"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="Holes Drilled"
                    value={stats.production.totalHoles}
                    icon={<EnvironmentOutlined />}
                    color="#722ed1"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="Diesel Consumed"
                    value={stats.production.totalDiesel}
                    suffix="L"
                    icon={<FireOutlined />}
                    color="#d46b08"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="Total Man-Days"
                    value={stats.labor.totalManDays}
                    suffix="days"
                    icon={<TeamOutlined />}
                    color="#eb2f96"
                    secondaryText="Total Daily Attendance"
                  />
                </Col>
              </Row>
            </div>

          </div>
        )}
      </Spin>
    </div>
  );
};

export default Dashboard;