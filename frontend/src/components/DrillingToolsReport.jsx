import React, { useState } from 'react';
import { Card, Table, DatePicker, Select, Button, Space, Tag, Row, Col, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '../service/api';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const DrillingToolsReport = () => {
    const [reportType, setReportType] = useState('machine-wise');
    const [dateRange, setDateRange] = useState([
        dayjs().subtract(30, 'days'),
        dayjs()
    ]);
    const [machineId, setMachineId] = useState(null);
    const [siteId, setSiteId] = useState(null);

    // Fetch machines
    const { data: machines = [] } = useQuery({
        queryKey: ['machines'],
        queryFn: async () => {
            const res = await api.get('/api/machines?limit=1000');
            return res.data.data || [];
        }
    });

    // Fetch sites
    const { data: sites = [] } = useQuery({
        queryKey: ['sites'],
        queryFn: async () => {
            const res = await api.get('/api/sites?limit=1000');
            return res.data.data || [];
        }
    });

    // Fetch report data
    const { data: reportData, isLoading, refetch } = useQuery({
        queryKey: ['drillingToolsReport', reportType, dateRange, machineId, siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateRange && dateRange[0]) params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
            if (dateRange && dateRange[1]) params.append('endDate', dateRange[1].format('YYYY-MM-DD'));
            if (machineId) params.append('machineId', machineId);
            if (siteId) params.append('siteId', siteId);

            const endpoint = reportType === 'machine-wise'
                ? '/api/drilling-tools/reports/machine-wise'
                : '/api/drilling-tools/reports/site-wise';

            const res = await api.get(`${endpoint}?${params.toString()}`);
            return res.data.data || [];
        },
        staleTime: 1 * 60 * 1000
    });

    const columns = [
        {
            title: 'Tool Name',
            dataIndex: 'toolName',
            key: 'toolName',
            width: 150,
            fixed: 'left'
        },
        {
            title: 'Part Number',
            dataIndex: 'partNumber',
            key: 'partNumber',
            width: 120
        },
        {
            title: 'RPM Source',
            dataIndex: 'rpmSource',
            key: 'rpmSource',
            width: 120,
            render: (val) => (
                <Tag color={val === 'machine' ? 'blue' : 'green'}>
                    {val === 'machine' ? 'Machine' : 'Compressor'}
                </Tag>
            )
        },
        reportType === 'machine-wise' ? {
            title: 'Machine',
            dataIndex: 'machine',
            key: 'machine',
            width: 150
        } : {
            title: 'Site',
            dataIndex: 'site',
            key: 'site',
            width: 150
        },
        reportType === 'machine-wise' ? {
            title: 'Site',
            dataIndex: 'site',
            key: 'site',
            width: 150
        } : {
            title: 'Machine',
            dataIndex: 'machine',
            key: 'machine',
            width: 150
        },
        {
            title: 'Fitted Date',
            dataIndex: 'fittedDate',
            key: 'fittedDate',
            width: 120,
            render: (date) => date ? dayjs(date).format('DD-MM-YYYY') : '-'
        },
        {
            title: 'Fitted RPM',
            dataIndex: 'fittedRPM',
            key: 'fittedRPM',
            width: 110,
            align: 'right',
            render: (val) => val ? val.toLocaleString() : '-'
        },
        {
            title: 'Removed Date',
            dataIndex: 'removedDate',
            key: 'removedDate',
            width: 130,
            render: (date) => date ? dayjs(date).format('DD-MM-YYYY') : '-'
        },
        {
            title: 'Removed RPM',
            dataIndex: 'removedRPM',
            key: 'removedRPM',
            width: 120,
            align: 'right',
            render: (val) => val ? val.toLocaleString() : '-'
        },
        {
            title: 'Accumulated Meter',
            dataIndex: 'accumulatedMeter',
            key: 'accumulatedMeter',
            width: 150,
            align: 'right',
            render: (val) => (
                <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                    {val ? val.toLocaleString() : '0'}
                </span>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            fixed: 'right',
            render: (status) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                    {status}
                </Tag>
            )
        }
    ];

    const handleExport = () => {
        if (!reportData || reportData.length === 0) {
            message.warning('No data to export');
            return;
        }

        const exportData = reportData.map(row => ({
            'Tool Name': row.toolName,
            'Part Number': row.partNumber,
            'RPM Source': row.rpmSource,
            'Machine': row.machine,
            'Site': row.site,
            'Fitted Date': row.fittedDate ? dayjs(row.fittedDate).format('DD-MM-YYYY') : '',
            'Fitted RPM': row.fittedRPM || '',
            'Removed Date': row.removedDate ? dayjs(row.removedDate).format('DD-MM-YYYY') : '',
            'Removed RPM': row.removedRPM || '',
            'Accumulated Meter': row.accumulatedMeter || 0,
            'Status': row.status
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Drilling Tools Report');

        const filename = `drilling_tools_${reportType}_${dayjs().format('YYYY-MM-DD')}.xlsx`;
        XLSX.writeFile(wb, filename);
        message.success('Report exported successfully');
    };

    return (
        <div className="p-4">
            <Card
                title="Drilling Tools Usage Report"
                extra={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => refetch()}
                        >
                            Refresh
                        </Button>
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            disabled={!reportData || reportData.length === 0}
                        >
                            Export Excel
                        </Button>
                    </Space>
                }
            >
                <Row gutter={[16, 16]} className="mb-4">
                    <Col xs={24} sm={12} md={6}>
                        <label className="block mb-2 font-medium">Report Type</label>
                        <Select
                            value={reportType}
                            onChange={setReportType}
                            style={{ width: '100%' }}
                        >
                            <Option value="machine-wise">Machine-wise</Option>
                            <Option value="site-wise">Site-wise</Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <label className="block mb-2 font-medium">Date Range</label>
                        <RangePicker
                            value={dateRange}
                            onChange={setDateRange}
                            format="DD-MM-YYYY"
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                        <label className="block mb-2 font-medium">Machine</label>
                        <Select
                            value={machineId}
                            onChange={setMachineId}
                            allowClear
                            placeholder="All Machines"
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                        >
                            {machines.map(m => (
                                <Option key={m.id} value={m.id}>
                                    {m.machineType} {m.machineNumber}
                                </Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                        <label className="block mb-2 font-medium">Site</label>
                        <Select
                            value={siteId}
                            onChange={setSiteId}
                            allowClear
                            placeholder="All Sites"
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                        >
                            {sites.map(s => (
                                <Option key={s.id} value={s.id}>
                                    {s.siteName}
                                </Option>
                            ))}
                        </Select>
                    </Col>
                </Row>

                <Table
                    columns={columns}
                    dataSource={reportData}
                    rowKey="installationId"
                    loading={isLoading}
                    scroll={{ x: 1500 }}
                    pagination={{
                        total: reportData?.length || 0,
                        pageSize: 50,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} installations`
                    }}
                    summary={(pageData) => {
                        const totalMeter = pageData.reduce((sum, row) => sum + (row.accumulatedMeter || 0), 0);
                        const activeCount = pageData.filter(row => row.status === 'ACTIVE').length;

                        return (
                            <Table.Summary fixed>
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={9}>
                                        <strong>Summary (Current Page)</strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={9} align="right">
                                        <strong style={{ color: '#1890ff' }}>
                                            {totalMeter.toLocaleString()}
                                        </strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={10}>
                                        <Tag color="green">{activeCount} Active</Tag>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        );
                    }}
                />
            </Card>
        </div>
    );
};

export default DrillingToolsReport;
