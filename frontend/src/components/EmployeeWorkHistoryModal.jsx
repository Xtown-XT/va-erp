import { useState, useEffect } from 'react';
import { Modal, Table, Typography, Tag, Space, DatePicker, Card, Row, Col, Statistic, message, Spin } from 'antd';
import { UserOutlined, CalendarOutlined, ToolOutlined } from '@ant-design/icons';
import api from '../service/api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

/**
 * EmployeeWorkHistoryModal - Shows employee work history with machines, roles, shifts
 */
const EmployeeWorkHistoryModal = ({ visible, onClose, employeeId, employeeName }) => {
  const [loading, setLoading] = useState(false);
  const [workHistory, setWorkHistory] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    if (visible && employeeId) {
      fetchWorkHistory();
    }
  }, [visible, employeeId, pagination.current, dateRange]);

  const fetchWorkHistory = async () => {
    setLoading(true);
    try {
      let url = `/api/employeeLists/${employeeId}/history?page=${pagination.current}&limit=${pagination.pageSize}`;
      
      if (dateRange && dateRange[0] && dateRange[1]) {
        url += `&startDate=${dateRange[0].format('YYYY-MM-DD')}&endDate=${dateRange[1].format('YYYY-MM-DD')}`;
      }

      const res = await api.get(url);
      
      setWorkHistory(res.data.data.workHistory || []);
      setStatistics(res.data.data.statistics || {});
      setPagination(prev => ({
        ...prev,
        total: res.data.data.pagination?.total || 0,
        current: res.data.data.pagination?.page || prev.current,
      }));
    } catch (err) {
      console.error('Error fetching work history:', err);
      message.error('Error fetching work history');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: '12%',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
    },
    {
      title: 'Ref No',
      dataIndex: 'refNo',
      key: 'refNo',
      width: '10%',
    },
    {
      title: 'Site',
      dataIndex: 'site',
      key: 'site',
      width: '13%',
    },
    {
      title: 'Machine',
      dataIndex: 'machine',
      key: 'machine',
      width: '12%',
      render: (machine, record) => (
        <div>
          <div><Text strong>{machine}</Text></div>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.machineType}</Text>
        </div>
      ),
    },
    {
      title: 'Compressor',
      dataIndex: 'compressor',
      key: 'compressor',
      width: '12%',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: '10%',
      render: (role) => (
        <Tag color={role === 'operator' ? 'blue' : 'green'}>
          {role === 'operator' ? 'Operator' : 'Helper'}
        </Tag>
      ),
    },
    {
      title: 'Shift',
      dataIndex: 'shift',
      key: 'shift',
      width: '8%',
      render: (shift) => <Tag>{shift}</Tag>,
    },
    {
      title: 'Machine RPM',
      key: 'machineRPM',
      width: '12%',
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div>Open: {record.vehicleOpeningRPM || 0}</div>
          <div>Close: {record.vehicleClosingRPM || 0}</div>
        </div>
      ),
    },
    {
      title: 'Comp. RPM',
      key: 'compressorRPM',
      width: '11%',
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div>Open: {record.compressorOpeningRPM || 0}</div>
          <div>Close: {record.compressorClosingRPM || 0}</div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          <span>Work History - {employeeName}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
      styles={{ body: { padding: '16px' } }}
    >
      <div>
        {/* Statistics Cards */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Days Worked"
                value={statistics.totalDaysWorked || 0}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="As Operator"
                value={statistics.operatorDays || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="As Helper"
                value={statistics.helperDays || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Unique Machines"
                value={statistics.uniqueMachinesCount || 0}
                prefix={<ToolOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Additional Statistics */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Text strong>Unique Sites: </Text>
              <Text>{statistics.uniqueSitesCount || 0}</Text>
            </Col>
            <Col span={8}>
              <Text strong>Total Present: </Text>
              <Text>{statistics.totalPresent || 0}</Text>
            </Col>
            <Col span={8}>
              <Text strong>Total Absent: </Text>
              <Text>{statistics.totalAbsent || 0}</Text>
            </Col>
          </Row>
        </Card>

        {/* Date Filter */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>Filter by Date:</Text>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              format="DD MMM YYYY"
              allowClear
            />
          </Space>
        </div>

        {/* Work History Table */}
        <Spin spinning={loading}>
          <Table
            dataSource={workHistory}
            columns={columns}
            rowKey={(record) => `${record.date}-${record.refNo}`}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              pageSizeOptions: ['20', '50', '100'],
              showTotal: (total) => `Total ${total} entries`,
            }}
            onChange={handleTableChange}
            size="small"
            scroll={{ x: 1000 }}
            locale={{ emptyText: 'No work history found' }}
          />
        </Spin>
      </div>
    </Modal>
  );
};

export default EmployeeWorkHistoryModal;

