import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Typography, Spin, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../service/api';

const { Text, Title } = Typography;

const ProductionDetail = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [productionData, setProductionData] = useState([]);
  const [sites, setSites] = useState([]);
  const [machines, setMachines] = useState([]);
  const [compressors, setCompressors] = useState([]);

  // Fetch all data
  const fetchProductionData = async () => {
    setLoading(true);
    try {
      // Get last 30 days of data
      const startDate = dayjs().subtract(30, 'days').format('YYYY-MM-DD');
      const endDate = dayjs().format('YYYY-MM-DD');
      
      const url = `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`;
      const response = await api.get(url);

      if (response.data.success || response.data.data) {
        const entries = response.data.data || [];
        
        // Transform data similar to ProductionReport
        const transformedData = entries.map((entry) => {
          const vehicle = entry.vehicle || machines.find(m => m.id === entry.vehicleId);
          const isCrawler = vehicle?.vehicleType?.toLowerCase().includes('crawler');
          const isCamper = vehicle?.vehicleType?.toLowerCase().includes('camper');
          
          const vehicleHSD = parseFloat(entry.vehicleHSD) || 0;
          const compressorHSD = parseFloat(entry.compressorHSD) || 0;
          
          let crawlerHSD = 0;
          let camperHSD = 0;
          
          if (isCrawler) {
            crawlerHSD = vehicleHSD;
          } else if (isCamper) {
            camperHSD = vehicleHSD;
          }
          
          const totalHSD = parseFloat((crawlerHSD + camperHSD + compressorHSD).toFixed(2));
          
          return {
            ...entry,
            site: entry.site,
            vehicle: entry.vehicle,
            isCrawler,
            isCamper,
            crawlerHSD,
            camperHSD,
            compressorHSD,
            totalHSD,
            employees: entry.employees || [],
          };
        });

        setProductionData(transformedData);
      }
    } catch (error) {
      console.error('Error fetching production data:', error);
      message.error('Failed to load production data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await api.get('/api/sites?limit=1000');
      setSites(res.data.data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchMachines = async () => {
    try {
      const res = await api.get('/api/vehicles?limit=1000');
      setMachines(res.data.data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const fetchCompressors = async () => {
    try {
      const res = await api.get('/api/compressors?limit=1000');
      setCompressors(res.data.data || []);
    } catch (error) {
      console.error('Error fetching compressors:', error);
    }
  };

  useEffect(() => {
    fetchSites();
    fetchMachines();
    fetchCompressors();
  }, []);

  useEffect(() => {
    if (sites.length > 0 || machines.length > 0 || compressors.length > 0) {
      fetchProductionData();
    }
  }, [sites.length, machines.length, compressors.length]);

  const truncateToFixed = (value, decimals) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00';
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals);
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
      fixed: 'left',
    },
    {
      title: 'Shift',
      dataIndex: 'shift',
      key: 'shift',
      width: 70,
      render: (shift) => <Tag>{shift || 1}</Tag>,
    },
    {
      title: 'Site',
      key: 'site',
      width: 150,
      render: (_, record) => {
        if (record.site?.siteName) {
          return record.site.siteName;
        }
        if (record.siteId) {
          const site = sites.find(s => s.id === record.siteId);
          return site?.siteName || '-';
        }
        return '-';
      },
    },
    {
      title: 'Machine',
      key: 'machine',
      width: 180,
      render: (_, record) => {
        const machine = record.vehicle || machines.find(m => m.id === record.vehicleId);
        if (!machine) return '-';
        return `${machine.vehicleType} (${machine.vehicleNumber})`;
      },
    },
    {
      title: 'Compressor',
      key: 'compressor',
      width: 150,
      render: (_, record) => {
        if (!record.compressorId) return '-';
        const compressor = compressors.find(c => c.id === record.compressorId);
        return compressor?.compressorName || '-';
      },
    },
    {
      title: 'Meter',
      dataIndex: 'meter',
      key: 'meter',
      width: 100,
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: 'Total HSD',
      dataIndex: 'totalHSD',
      key: 'totalHSD',
      width: 100,
      render: (value) => Math.round(value || 0),
    },
    {
      title: 'Holes',
      dataIndex: 'noOfHoles',
      key: 'noOfHoles',
      width: 80,
      render: (value) => value || 0,
    },
    {
      title: 'Employees',
      key: 'employees',
      width: 300,
      render: (_, record) => {
        const employees = record.employees || [];
        if (employees.length === 0) {
          return <Text type="secondary">No employees</Text>;
        }
        return (
          <div>
            {employees.map((emp, idx) => {
              const role = emp.role || emp.DailyEntryEmployee?.role || 'operator';
              const shift = emp.shift || emp.DailyEntryEmployee?.shift || 1;
              return (
                <div key={idx} style={{ marginBottom: 4 }}>
                  <Tag color={role === 'operator' ? 'blue' : 'green'}>
                    {emp.name || emp.empId} ({role}) - Shift {shift}
                  </Tag>
                </div>
              );
            })}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/reports/production')}
          >
            Back to Production Report
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            All Production Entries with Employees
          </Title>
        </Space>
      </Card>

      <Card>
        <Spin spinning={loading}>
          <Table
            dataSource={productionData}
            rowKey="id"
            columns={columns}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `Total ${total} entries`,
            }}
            scroll={{ x: 1200, y: 600 }}
            size="small"
          />
        </Spin>
      </Card>
    </div>
  );
};

export default ProductionDetail;

