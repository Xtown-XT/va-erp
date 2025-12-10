import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Select, Spin, Typography, message, Space, Button } from 'antd';
import {
  DollarCircleOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
  FireOutlined,
  TeamOutlined,
  FileTextOutlined
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

  const StatCard = ({ title, value, prefix, suffix, color, icon }) => (
    <Card bordered={false} className="shadow-sm hover:shadow-md transition-shadow h-full">
      <Statistic
        title={<Space>{icon && <span style={{ color }}>{icon}</span>} {title}</Space>}
        value={value}
        precision={2}
        valueStyle={{ color: color || '#3f8600' }}
        prefix={prefix}
        suffix={suffix}
      />
    </Card>
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
            {/* Financials Row */}
            <div>
              <Title level={4}><DollarCircleOutlined /> Financials (Purchase Orders)</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                  <Card>
                    <Statistic
                      title="Total PO Value (Expense)"
                      value={stats.po.totalValue}
                      formatter={val => formatCurrency(val)}
                      valueStyle={{ color: '#cf1322' }}
                      prefix={<DollarCircleOutlined />}
                    />
                    <Text type="secondary" className="text-xs">
                      Total value of all raised POs in selected period
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                  <Card>
                    <Statistic
                      title="Value Received"
                      value={stats.po.receivedValue}
                      formatter={val => formatCurrency(val)}
                      valueStyle={{ color: '#3f8600' }}
                    />
                    <Text type="secondary" className="text-xs">
                      Value of goods mark as "Received"
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                  <Card>
                    <Statistic
                      title="Total POs Created"
                      value={stats.po.count}
                      prefix={<FileTextOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* Production Row */}
            <div>
              <Title level={4}><ThunderboltOutlined /> Production & Operations</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                  <Card>
                    <Statistic
                      title="Total Meters Drilled"
                      value={stats.production.totalMeter}
                      suffix="m"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                  <Card>
                    <Statistic
                      title="Total Holes Drilled"
                      value={stats.production.totalHoles}
                      prefix="#"
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                  <Card>
                    <Statistic
                      title="Total Diesel Consumed"
                      value={stats.production.totalDiesel}
                      suffix="Liters"
                      prefix={<FireOutlined />}
                      valueStyle={{ color: '#d46b08' }}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* Labor Row */}
            <div>
              <Title level={4}><TeamOutlined /> Workforce</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="Total Man-Days"
                      value={stats.labor.totalManDays}
                      suffix="days"
                    />
                    <Text type="secondary" className="text-xs">
                      Total attendance days recorded
                    </Text>
                  </Card>
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